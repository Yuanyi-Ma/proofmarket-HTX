# AI 审判团升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把挑战环节从「单 resolver 一票裁决」升级为 10 号文档的 AI 审判团闭环：审判费 F、3 席多数决投票（附理由书哈希）、应辩窗口 R_w、挑战窗口 W_c，全部真实上链（Sepolia），内容预制。

**Architecture:** 合约层重写 ChallengeManager 投票状态机 + Escrow 加 complete 时间门禁，重部署（沿用 MockUSDC / ERC-8004）。服务层（services 进程）持有 provider key 和 3 把审判 key，新增 `/provider/defend` 与 `/jury/vote` 端点签链上交易。后端 realTaskService 编排：开挑战收 D+F → 自动应辩 → 3 票（2:1）→ resolve。前端 Step5 改为应辩卡 + 3 票理由书展示，Step6 结算加 W_c 倒计时。

**Tech Stack:** Solidity 0.8.24 / Hardhat、viem、Node http services、Next.js 15、vitest。

**Spec:** `../../../spec/proofmarket-demo/ai-jury-upgrade-spec.md`（参数：D=2、F=0.5、S=5、R=2.5、W_c=300s、R_w=120s、N=3 多数=2）

**约定:** 每个 task 完成后 `git commit`。分支 `feature/ai-jury`（从 feature/real-success-path 切出）。

---

### Task 1: ChallengeManager v2（审判费 + 3 席投票 + 应辩窗口）

**Files:**
- Modify: `packages/contracts/contracts/ProofMarketChallengeManager.sol`（整体重写）
- Test: `packages/contracts/test/ProofMarketChallengeManager.test.ts`（重写挑战流测试）

- [ ] **Step 1.1: 重写合约**

保留：`stake/lockedStake/depositStake/withdrawStake/hasMinStake/lockStakeForJob/unlockStakeForJob`、`IEscrowChallengeHooks`、`setEscrow`、`activeChallenges`。删除：`resolver` 角色与 `resolve(challengeId, result)`。

新增状态与函数（完整签名）：

```solidity
struct Juror { bytes32 modelHash; bytes32 promptHash; bool registered; }

struct Challenge {
    uint256 challengeId;
    uint256 jobId;
    ChallengeType challengeType;
    bytes32 challengeHash;
    ChallengeResult result;
    address challenger;
    address provider;
    uint64 openedAt;       // 应辩/投票窗口锚点
    bytes32 defenseHash;   // 0 = 未应辩
    uint8 faultVotes;
    uint8 notFaultVotes;
}

uint256 public juryFee;       // F（总额，审判方均分，尘差进国库）
uint256 public defenseWindow; // R_w 秒
uint256 public jurySize;      // N（必须奇数）
address[] public jurorList;
mapping(address => Juror) public jurors;
mapping(uint256 => mapping(address => ChallengeResult)) public votes;          // Pending = 未投
mapping(uint256 => mapping(address => bytes32)) public voteReasonHash;

event JurorRegistered(address indexed juror, bytes32 modelHash, bytes32 promptHash);
event DefenseSubmitted(uint256 indexed challengeId, bytes32 defenseHash);
event JurorVoted(uint256 indexed challengeId, address indexed juror, ChallengeResult result, bytes32 reasonHash);
event ChallengeResolved(uint256 indexed challengeId, ChallengeResult result,
    uint256 slashAmount, uint256 challengerPayout, uint256 juryPayout, uint256 treasuryPayout);
```

constructor 改为 `(token_, treasury_, minStake_, challengeDeposit_, slashBps_, slashRewardBps_, juryFee_, defenseWindow_, jurySize_)`，加参数约束（文档 §4.3 / §5.5）：

```solidity
require(juryFee_ < challengeDeposit_, "F must be < D");
uint256 slashAmount_ = (minStake_ * slashBps_) / BPS_DENOMINATOR;
uint256 reward_ = (slashAmount_ * slashRewardBps_) / BPS_DENOMINATOR;
require(reward_ + juryFee_ < slashAmount_, "R+F must be < S");
require(jurySize_ >= 1 && jurySize_ % 2 == 1, "jury size must be odd");
```

新函数完整实现：

```solidity
function registerJuror(address account, bytes32 modelHash, bytes32 promptHash) external {
    require(msg.sender == owner, "only owner");
    require(account != address(0), "juror required");
    require(modelHash != bytes32(0) && promptHash != bytes32(0), "commitments required");
    require(!jurors[account].registered, "already registered");
    require(jurorList.length < jurySize, "jury full");
    jurors[account] = Juror({modelHash: modelHash, promptHash: promptHash, registered: true});
    jurorList.push(account);
    emit JurorRegistered(account, modelHash, promptHash);
}

function jurorCount() external view returns (uint256) { return jurorList.length; }

function submitDefense(uint256 challengeId, bytes32 defenseHash) external {
    Challenge storage c = challenges[challengeId];
    require(c.challengeId != 0, "challenge not found");
    require(c.result == ChallengeResult.Pending, "already resolved");
    require(msg.sender == c.provider, "only provider");
    require(block.timestamp <= uint256(c.openedAt) + defenseWindow, "defense window closed");
    require(defenseHash != bytes32(0), "defense hash required");
    require(c.defenseHash == bytes32(0), "defense already submitted");
    c.defenseHash = defenseHash;
    emit DefenseSubmitted(challengeId, defenseHash);
}

function castVote(uint256 challengeId, ChallengeResult result, bytes32 reasonHash) external {
    Challenge storage c = challenges[challengeId];
    require(c.challengeId != 0, "challenge not found");
    require(c.result == ChallengeResult.Pending, "already resolved");
    require(jurors[msg.sender].registered, "only juror");
    // 强制兼听（文档 §5.3c）：应辩窗口未过不得出票
    require(block.timestamp > uint256(c.openedAt) + defenseWindow, "defense window open");
    require(result != ChallengeResult.Pending, "result required");
    require(reasonHash != bytes32(0), "reason book required"); // §5.3b
    require(votes[challengeId][msg.sender] == ChallengeResult.Pending, "already voted");
    votes[challengeId][msg.sender] = result;
    voteReasonHash[challengeId][msg.sender] = reasonHash;
    if (result == ChallengeResult.ProviderFault) { c.faultVotes += 1; } else { c.notFaultVotes += 1; }
    emit JurorVoted(challengeId, msg.sender, result, reasonHash);
}

/// @notice 多数已达成后任何人可执行裁决（票在链上，执行无裁量）。
function resolve(uint256 challengeId) external {
    Challenge storage c = challenges[challengeId];
    require(c.challengeId != 0, "challenge not found");
    require(c.result == ChallengeResult.Pending, "already resolved");
    uint256 majority = jurySize / 2 + 1;
    require(c.faultVotes >= majority || c.notFaultVotes >= majority, "no majority yet");
    ChallengeResult result = c.faultVotes >= majority
        ? ChallengeResult.ProviderFault : ChallengeResult.ProviderNotFault;
    c.result = result;
    activeChallenges[c.provider] -= 1;

    uint256 feePerJuror = juryFee / jurorList.length;
    uint256 juryPayout = feePerJuror * jurorList.length;
    uint256 dust = juryFee - juryPayout; // 除不尽的尘差进国库，守恒
    uint256 slashAmount = 0; uint256 challengerPayout = 0; uint256 treasuryPayout = 0;

    if (result == ChallengeResult.ProviderFault) {
        slashAmount = (minStake * slashBps) / BPS_DENOMINATOR;
        stake[c.provider] -= slashAmount;
        lockedStake[c.provider] -= minStake;
        uint256 reward = (slashAmount * slashRewardBps) / BPS_DENOMINATOR;
        // 挑战成功：D、F 全退 + 奖励 R；审判费由扣罚承担（§4.3）
        challengerPayout = reward + challengeDeposit + juryFee;
        treasuryPayout = slashAmount - reward - juryFee + dust;
        require(token.transfer(c.challenger, challengerPayout), "challenger transfer failed");
        IEscrowChallengeHooks(escrow).refundForChallenge(c.jobId);
    } else {
        // 挑战失败：F 付审判团、D 进国库（§4.3）
        treasuryPayout = challengeDeposit + dust;
        IEscrowChallengeHooks(escrow).unfreezeForChallenge(c.jobId);
    }
    for (uint256 i = 0; i < jurorList.length; i++) {
        require(token.transfer(jurorList[i], feePerJuror), "juror transfer failed");
    }
    if (treasuryPayout > 0) {
        require(token.transfer(treasury, treasuryPayout), "treasury transfer failed");
    }
    emit ChallengeResolved(challengeId, result, slashAmount, challengerPayout, juryPayout, treasuryPayout);
}
```

`openChallenge` 改动两处：收款 `challengeDeposit + juryFee`；写 `openedAt: uint64(block.timestamp)`，并 `require(jurorList.length == jurySize, "jury not seated")`。

- [ ] **Step 1.2: 重写测试**（`npx hardhat test` 于 packages/contracts）

覆盖至少：constructor 参数约束 3 条 revert；registerJuror 满员/重复 revert；openChallenge 收 D+F（断言合约余额变化 = 2.5e6）；submitDefense 窗口内成功/窗口外 revert/非 provider revert；castVote 窗口未过 revert、非 juror revert、reasonHash=0 revert、重复投票 revert；resolve 无多数 revert；**2:1 ProviderFault 全资金断言**（challenger +2.5+2.5=+5e6 净 +2.5e6；3 juror 各 +166666；treasury +5e6−2.5e6−0.5e6+2=+2500002；provider stake −5e6、locked −10e6；buyer 退款）；**2:1 NotFault**（jurors 各 +166666、treasury +2000002、job 回 Submitted）。测试里用 `await ethers.provider.send("evm_increaseTime", [121])` 跳过 R_w。

- [ ] **Step 1.3: Commit** `feat(contracts): jury voting + fee + defense window in ChallengeManager`

---

### Task 2: Escrow 挑战窗口 W_c 门禁

**Files:**
- Modify: `packages/contracts/contracts/ProofMarketEscrow.sol`
- Test: `packages/contracts/test/ProofMarketEscrow.test.ts`

- [ ] **Step 2.1:** constructor 改 `constructor(uint256 challengeWindow_)`，存 `uint256 public challengeWindow;`。加 `mapping(uint256 => uint256) public submittedAt;`。`submit()` 内加 `submittedAt[jobId] = block.timestamp;`。`complete()` 加门禁（在 state 检查后）：

```solidity
// 挑战窗口门禁（10 号文档 §三）：窗口未过不得放款，否则挑战权形同虚设。
require(block.timestamp >= submittedAt[jobId] + challengeWindow, "challenge window open");
```

- [ ] **Step 2.2:** 测试：complete 在窗口内 revert "challenge window open"；`evm_increaseTime(301)` 后成功。现有测试 fixture 的 Escrow 部署改为传 `challengeWindow=300`（或测试用 5 秒便于跑），既有用例在 increaseTime 后保持绿。
- [ ] **Step 2.3:** Commit `feat(contracts): challenge window gate on Escrow.complete`

---

### Task 3: chain 包 — ABI、签名器、resolve 单参化

**Files:**
- Modify: `packages/chain/src/escrowAbi.ts`（challengeManagerAbi 增 `registerJuror/submitDefense/castVote/resolve(uint256)/jurors/jurorList/juryFee/defenseWindow/jurySize/jurorCount` 与新 events；escrowAbi 增 `submittedAt/challengeWindow`、constructor 变更）
- Modify: `packages/chain/src/challengeResolver.ts`（`resolve` 改单参 `{ challengeId }`）
- Create: `packages/chain/src/jurySigner.ts`
- Modify: `packages/chain/src/index.ts`（导出）

- [ ] **Step 3.1:** ABI 按新合约逐函数补齐（与 solc 输出一致的 minimal human-readable 条目，照既有文件风格手写）。
- [ ] **Step 3.2:** `jurySigner.ts`——模式照抄 `challengeResolver.ts`：

```ts
export type CastVoteOnChain = (input: {
  challengeId: bigint; result: number; reasonHash: `0x${string}`;
}) => Promise<{ txHash: string }>;
export function createJuryVoter(input: { rpcUrl: string; privateKey: `0x${string}`;
  challengeManagerAddress: `0x${string}` }): CastVoteOnChain { /* writeContract castVote + waitForReceipt + assertReceiptSuccess */ }

export type SubmitDefenseOnChain = (input: {
  challengeId: bigint; defenseHash: `0x${string}`;
}) => Promise<{ txHash: string }>;
export function createDefenseSubmitter(/* 同上, functionName: submitDefense */) {}
```

- [ ] **Step 3.3:** `pnpm --filter @proofmarket/chain typecheck`（或根 typecheck）通过。Commit `feat(chain): jury vote/defense signers + v2 ABIs`

---

### Task 4: shared 类型与预制内容

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/fixtures.ts`
- Modify: `data/fixtures/challenge-path.json`、`data/fixtures/happy-path.json`（同形更新）

- [ ] **Step 4.1: types.ts**

```ts
export type JuryVote = {
  jurorId: string;               // "juror-anthropic" 等
  jurorAddress: string;
  modelFamily: string;           // "Anthropic Claude 系" 等（预制承诺）
  vote: "ProviderFault" | "ProviderNotFault";
  reasonCode: string;
  /** 理由书（L2 三问逐答，文档 §4.2），明文展示、哈希上链 */
  reasonBook: { inScope: string; hitsDeclaredQuery: string; notReturnedNotExcluded: string; conclusion: string };
  reasonHash: string;
  txHash?: string | null;        // castVote 交易（real 模式）
};
export type ChallengeDefense = {
  statement: string;             // 应辩书明文（预制）
  defenseHash: string;
  txHash?: string | null;
};
export type TaskChallenge = {
  type: "CoverageMiss";
  statement: string;             // 挑战书：挑战者陈述
  hitCoverageClause: string;     // 命中覆盖声明的哪一条
  counterEvidenceHash: string;
  challengeId?: number | null;
  defense?: ChallengeDefense | null;
  votes?: JuryVote[] | null;     // 3 票（替代旧单票 vote 字段）
  resolvedTxHash?: string | null;
};
// ProviderProfile.challengeHistory: string → 结构化（文档 §七：结构化计数，非自由文本）
challengeStats: { challenged: number; upheld: number };
// Task 增加：
challengeWindowEndsAt?: string | null;  // submit 确认后 = now + W_c，结算门禁与 UI 倒计时用
```

删除旧 `ChallengeVote` 类型与 `TaskChallenge.vote` 字段，全仓修引用。

- [ ] **Step 4.2: fixtures.ts** 新增预制内容（明文完整写出，不留 TBD）：
  - `presetChallengeDocument`：statement（挑战者陈述：覆盖声明承诺 2021-2026 执行加速方向，交付包未含 Block-STM——该方向代表性工作；附反例 locator arXiv:2203.06871）、hitCoverageClause（引用 provider coverageStatement 中"2021-2026 区块链执行加速"一句）。
  - `presetDefense`：弱应辩（"检索词按声明字面执行，Block-STM 属并行执行子方向，认为不在承诺范围内"——可被三问驳回）。
  - `presetJuryVotes(jurorAddresses: string[])`：3 票 **2:1**。juror-anthropic（Fault）、juror-openai（Fault）三问均答"是"；juror-google（NotFault）异议理由书（"声明语义对子方向覆盖存在解释空间，倾向不构成失职"）。reasonHash 用 `stableHash(reasonBook)`。
  - 三个 providerProfiles 的 `challengeHistory` 改为 `challengeStats`：expert `{challenged: 0, upheld: 0}`、shallow `{challenged: 5, upheld: 3}`、ieee `{challenged: 1, upheld: 0}`。
  - 预制审判方元数据 `presetJurors`: `[{ jurorId, modelFamily, modelVersionTag, promptTag }]`（modelHash/promptHash = stableHash(tag)，与部署脚本共用）。
- [ ] **Step 4.3:** 更新两个 data/fixtures JSON（challenge-path 加 statement/hitCoverageClause/defense/votes 3 票；删 vote 单票）。`pnpm --filter @proofmarket/shared test` 过。
- [ ] **Step 4.4:** Commit `feat(shared): jury vote/defense schemas + preset jury content`

---

### Task 5: services — /provider/defend 与 /jury/vote

**Files:**
- Modify: `packages/services/src/server.ts`（删 `/resolver/vote`，加两端点）
- Modify: `packages/services/src/boot.ts`（装配 defense submitter + 3 个 jury voter；env：`JUROR1/2/3_PRIVATE_KEY`）

- [ ] **Step 5.1: `/provider/defend`** 入参 `{ challengeId }`。行为：取 `presetDefense` → `defenseHash = stableHash(presetDefense)` → `submitDefenseOnChain({challengeId, defenseHash})`（provider key 签）→ 返回 `{ statement, defenseHash, txHash }`。无签名器时 503（同 submit 的现行做法）。
- [ ] **Step 5.2: `/jury/vote`** 入参 `{ challengeId, openedAtMs }`。行为：

```ts
// 强制兼听：合约在 openedAt + R_w 前会 revert，这里先把剩余窗口睡掉（+5s 余量）
const waitMs = openedAtMs + DEFENSE_WINDOW_MS + 5000 - Date.now();
if (waitMs > 0) await sleep(waitMs);
// 三票依次上链（2:1 预制），逐票返回 reasonBook + reasonHash + txHash
for (const [i, vote] of presetJuryVotes(jurorAddresses).entries()) {
  const { txHash } = await juryVoters[i]({ challengeId, result: vote.vote === "ProviderFault" ? 1 : 2,
    reasonHash: vote.reasonHash as `0x${string}` });
  results.push({ ...vote, txHash });
}
```

`DEFENSE_WINDOW_MS` 从部署产物 `challengeManagerParams.defenseWindow` 读。
- [ ] **Step 5.3:** boot.ts 打印 `Jury voters: ENABLED (3)` / `DISABLED`。手测：`npx tsx --env-file=.env packages/services/src/boot.ts` 启动日志正确。Commit `feat(services): defense + jury vote endpoints with on-chain signing`

---

### Task 6: 部署脚本 v2 + Sepolia 重部署（真链操作，直接做）

**Files:**
- Modify: `packages/contracts/scripts/deploy-sepolia.ts`
- Modify: `.env`（追加 3 把审判 key）、`deployments/sepolia.json`（脚本产出）

- [ ] **Step 6.1:** 生成 3 把审判 key（`viem generatePrivateKey`），追加 `.env`：`JUROR1_PRIVATE_KEY/ADDRESS` ×3。
- [ ] **Step 6.2:** 脚本改动：沿用已部署 MockUSDC 与 ERC-8004（地址从旧 artifact 读入）；部署 `Escrow(300)`、`ChallengeManager(token, treasury, 10e6, 2e6, 5000, 5000, 5e5, 120, 3)`；双向 wire；`registerJuror` ×3（modelHash/promptHash = keccak(presetJurors tag)）；deployer 给 3 juror 各转 0.03 SETH（castVote gas）；expert provider（PROVIDER_SIGNER）mint 20 mUSDC → approve 新 CM → depositStake(20e6)；Cobo 钱包 mint 10 mUSDC（D+F 余量）。artifact 写入 `challengeManagerParams`（含 `juryFee/defenseWindow/jurySize`）、`escrowParams.challengeWindow`、`jurors[]`。
- [ ] **Step 6.3:** 执行重部署（testnet 直接做），跑 `scripts/check-real-env.ts` 验证；记录新地址。
- [ ] **Step 6.4:** Commit `feat(deploy): v2 redeploy with jury seat registration + windows`

---

### Task 7: backend realTaskService 编排

**Files:**
- Modify: `packages/backend/src/realTaskService.ts`
- Test: `packages/backend/tests/realTaskService.test.ts`

- [ ] **Step 7.1: 成功路径 W_c。** `runProvider` 在 submit 确认后：`challengeWindowEndsAt = new Date(Date.parse(deps.now()) + challengeWindowMs).toISOString()`（窗口长度从 artifact `escrowParams.challengeWindow` 读）。`settle` 入口检查未到点则 throw `挑战窗口未结束，剩余 N 秒`（UI 按钮本身会禁用，此为防御）。audit 提示「挑战窗口 5 分钟，窗口内可发起挑战」。
- [ ] **Step 7.2: openChallenge。** approve 金额改 `deposit + juryFee`；audit 写明「押金 2 + 审判费 0.5」；challenge 对象带 `statement/hitCoverageClause`（presetChallengeDocument）。开链成功后调 `deps.services.providerDefend({challengeId})` → 存 `challenge.defense` + audit（source: "provider", type: "defense_submitted", 带 txHash）。记录 `challengeOpenedAtMs`（用 `deps.now()`）存到内存 Map（同 verdicts 模式）。
- [ ] **Step 7.3: winChallenge → 审判团。** 调 `deps.services.juryVote({challengeId, openedAtMs})`（services 内部睡掉 R_w）。逐票 audit（source: "verifier", type: "jury_vote", message 含 jurorId/方向/reasonHash/txHash）。存 `challenge.votes`，2:1 多数 Fault → 转 ChallengeWon；audit 总结「审判团 2:1 判 ProviderFault」。
- [ ] **Step 7.4: refundOrSlash。** `deps.resolveChallenge({challengeId})`（单参）。audit 资金行加「审判费 0.5 付审判团（扣罚承担）」。负面信誉 feedback 保持 `challenge.coverage_miss`。
- [ ] **Step 7.5:** RealDeps 接口：`services.providerDefend` / `services.juryVote` 替换 `resolverVote`；`resolveChallenge` 单参。`apps/web/lib/api.ts` 装配同步改（services HTTP 客户端 + challengeWindow 从 artifact 读）。
- [ ] **Step 7.6:** 测试 mock 更新跑绿。Commit `feat(backend): jury orchestration in real challenge flow`

---

### Task 8: fixture 模式同形

**Files:**
- Modify: `packages/backend/src/taskService.ts`

- [ ] **Step 8.1:** openChallenge 写入 statement/hitCoverageClause + 预制 defense；winChallenge 写入 `votes: presetJuryVotes(...)`（无 txHash），audit 同款 2:1 文案；refundOrSlash 文案加审判费行。`challengeWindowEndsAt` fixture 模式置为交付时刻（不阻塞 fixture 演示）。测试更新跑绿。
- [ ] **Step 8.2:** Commit `feat(backend): fixture parity for jury flow`

---

### Task 9: 前端 UI

**Files:**
- Modify: `apps/web/components/steps/Step5Evidence.tsx`
- Modify: `apps/web/components/steps/Step6Done.tsx`
- Modify: `apps/web/components/steps/Step2Plan.tsx`
- Modify: `apps/web/app/globals.css`（投票卡样式）
- Tests: `apps/web/tests/step5.test.tsx`、`step2.test.tsx`、`step6.test.tsx`、`ui-content.test.tsx`、`wizard-flow.test.tsx`

- [ ] **Step 9.1: Step5 挑战流。**
  - 交付态（Delivered, real 模式）：info-strip 改为挑战窗口横幅——「挑战窗口剩余 m:ss（窗口内可挑战；窗口结束后才可结算）」，从 `task.challengeWindowEndsAt` 用 `useEffect` 每秒刷新。
  - Stage1：挑战书卡（statement + hitCoverageClause + 反证明文，沿用 ChallengeMaterials 扩展）；押金行拆「挑战押金 2 mUSDC」「审判费 0.5 mUSDC」两行；新增**应辩卡**：「Provider 应辩（窗口 2 分钟）」+ statement 明文 + defenseHash + tx 链接；按钮文案改「请求审判团裁决」（busy 文案「审判团裁决中（等待应辩窗口结束）…」）。
  - Stage2 → **审判团投票**：header「审判团投票 2 : 1 — ProviderFault（挑战成立）」；3 张投票卡（`<details>`），summary = jurorId + modelFamily + 方向徽章，body = 理由书三问逐答（范围内？/命中声明？/未返回且未排除？）+ conclusion + reasonHash + castVote tx 链接；下方注明「每票理由书哈希已上链，模型版本与 prompt 哈希注册时已承诺，任何人可重跑复核」。按钮「执行裁决」保留。
  - Stage3 资金行增加「审判费 0.5 mUSDC 付审判团（由扣罚承担）」；底部一行 muted：「上诉窗口与扩编重审：后续可做」。
  - `ChallengeTxRow` labelMap 增 `defense: "提交应辩书（链上）"`、`castVote: "审判投票（链上）"`。
- [ ] **Step 9.2: Step6 结算门禁。** Verified 态结算按钮在 `challengeWindowEndsAt` 未到时 disabled，文案「挑战窗口剩余 m:ss 后可结算」；到点恢复「结算付款」。
- [ ] **Step 9.3: Step2 结构化计数。** 候选卡 challengeHistory 文本改为 `被挑战 {challenged} 次 / 成立 {upheld} 次`（0 挑战显示「无挑战记录」）。
- [ ] **Step 9.4:** 组件测试更新（断言 2:1 header、3 张投票卡、结构化计数、结算禁用态）。`pnpm test` + `pnpm typecheck` 全绿。Commit `feat(web): jury verdict UI + challenge/defense windows`

---

### Task 10: 录屏驱动与文档同步

**Files:**
- Modify: `apps/web/capture-demo.mjs`
- Modify: `spec/proofmarket-demo/demo-script.md`
- Modify: `README.md`（流程描述若涉及）

- [ ] **Step 10.1:** capture 脚本：成功路径在 verify 后等 `challengeWindowEndsAt`（轮询按钮可用，timeout 600s）再 settle；挑战路径在 openChallenge 后截「应辩卡」（新 shot `11b-challenge-defense`，或并入 11），点「请求审判团裁决」（timeout 600s，内含 R_w 等待 + 3 笔投票），截 3 票屏（12），resolve 截 13。两个路径全量重跑、重截。
- [ ] **Step 10.2:** demo-script.md 同步：第 5/6 步文案（窗口、押金+审判费、应辩、3 票 2:1、理由书、resolve 任何人可执行）、参数表、「后续可做」清单（审判方质押/超时中性/上诉重审/L1/L3）。
- [ ] **Step 10.3:** Commit `docs(demo): jury flow capture + script sync`

---

## Self-Review 结论

- Spec 条款 1-8 → Task 1/2；9-11 → Task 4/5；12-15 → Task 7/9；16 → Task 8/9.4。无未覆盖条款。
- 类型一致性：`JuryVote/ChallengeDefense` 在 Task 4 定义，5/7/8/9 全部引用同名；`resolve(challengeId)` 单参在 3/7 一致；`challengeWindowEndsAt` 在 4/7/9 一致。
- 资金守恒已在 Task 1 测试断言（含 dust=2 的精确值）。
