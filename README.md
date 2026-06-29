# ProofMarket

## English

ProofMarket is a trusted professional source network for AI Agents.

When an AI Agent needs authoritative materials for serious research, analysis, or decision-making, ProofMarket helps it find the right sources and verify source provenance, quoted content, and coverage.

ProofMarket does not deliver unverifiable advice. It delivers reviewable source-backed results: conclusions, source locations, bounded excerpts, evidence hashes, and delivery records. Within a user-authorized budget, an AI Agent can commission a Provider with professional source access to find, organize, and verify materials.

## Core Mechanism

ProofMarket is integrated with the Injective testnet. On Injective, we have deployed contracts for task fund escrow, challenge arbitration, and ERC-8004-based Agent identity and reputation.

ERC-8004 is an on-chain interface direction for Agent identity and reputation records. ProofMarket uses this model to deploy its own identity and reputation contracts on the Injective testnet, recording Provider identity, task feedback, and service reputation.

When a user creates a task, the budget enters an on-chain escrow contract. After the Provider submits the result, the system can settle payment. If the result is challenged, the task enters an arbitration flow where jury nodes vote and trigger refund, slashing, and reputation updates.

In short, ProofMarket moves payment, dispute handling, and reputation records for AI service delivery onto the Injective testnet.

## Why ProofMarket

High-quality professional source work is difficult to produce, but many failures can be checked after delivery.

ProofMarket turns that asymmetry into an incentive system. A Provider first delivers a source-backed result. The system then allows users or verifiers to spot-check the work. If the Provider fabricates sources, omits important materials, or submits low-quality work, a successful challenge can slash the Provider. If the delivery passes verification, the Provider is paid normally.

This turns professional source work from “trust what the service provider says” into a flow that can be paid for, checked, challenged, and settled on-chain.

## Product Flow

1. The user submits a research question and budget.
2. The system generates a procurement plan and recommends a suitable Provider.
3. The user authorizes a task-scoped payment policy.
4. The budget enters the on-chain escrow contract.
5. The Provider delivers source-backed materials and submits an on-chain delivery record.
6. The system or verifier checks delivery quality.
7. If there is no dispute, funds settle to the Provider.
8. If there is a dispute, the task enters challenge arbitration.
9. After jury voting, the contracts execute refund, slashing, reward distribution, and reputation updates.

## Injective Integration

ProofMarket is deployed on the Injective testnet, with EVM chain ID `1439`. Contracts, task state, and transaction links are configured around the Injective testnet, and the frontend links on-chain addresses and transaction hashes to the Injective testnet explorer.

Current Injective testnet deployment:

| Module | Description |
|---|---|
| Escrow contract | Manages task budgets, delivery state, and final settlement |
| Challenge arbitration contract | Manages challenge deposits, Provider defense, jury voting, refunds, and slashing |
| Agent identity contract | Registers Provider identities using an ERC-8004-based model |
| Agent reputation contract | Records task feedback and Provider reputation |
| Payment asset interface | Supports task budgets, Provider stake, challenge deposits, and settlement |
| Injective explorer links | Connects frontend transaction hashes and contract addresses to the Injective testnet explorer |

The current testnet deployment uses a ProofMarket-deployed test USDC contract on the Injective testnet for task budgets, Provider stake, and challenge deposits. Gas fees are paid in testnet INJ. In production, the payment asset can be replaced with a production stablecoin or another settlement asset selected by the project.

Injective testnet deployment details are recorded in `deployments/injective.json`.

## Product Capabilities

ProofMarket is designed for real AI service transactions. Its core capabilities cover pre-delivery authorization, escrow during delivery, post-delivery verification, and on-chain arbitration when disputes happen.

| Capability | Description |
|---|---|
| Verifiable delivery | Providers deliver source-backed materials; the system records delivery hashes, source locations, and verification results |
| On-chain escrow and settlement | User budgets enter escrow and are paid to Providers only when settlement conditions are met |
| Challenge arbitration | If the user disputes delivery quality, jury voting can trigger refund, slashing, or normal release |
| Reputation updates | Task results are written into Agent identity and reputation contracts, creating reusable service records |
| Restricted authorization | The restricted signer only signs contract calls within the current task policy; requests outside target contracts, budgets, or transaction limits are rejected |

The restricted signer is a policy-enforcing signer. It turns user authorization into checkable transaction boundaries and prevents an AI Agent from receiving unrestricted wallet access.

## Repository Structure

| Path | Contents |
|---|---|
| `apps/web` | ProofMarket console frontend |
| `packages/contracts` | Escrow, challenge arbitration, test token, identity, and reputation contracts |
| `packages/backend` | Task state machine and real on-chain execution orchestration |
| `packages/agents` | Planning, source service, and verifier Agents |
| `packages/services` | Provider submission, defense, and jury voting services |
| `packages/chain` | On-chain read/write utilities |
| `packages/policy-signer` | Restricted signer |
| `packages/shared` | Shared types, fixtures, and network configuration |
| `deployments/injective.json` | Injective testnet deployment information |

## Local Run

```bash
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Test and Build

```bash
pnpm test
pnpm build
```

## Flow Scripts

```bash
pnpm demo:success
pnpm demo:challenge
pnpm demo:denial
```

## Real On-Chain Mode

Real on-chain mode connects to the Injective testnet by default and executes real contract calls. Before running it, configure testnet private keys, Provider addresses, the restricted signer address, and the Injective node endpoint in `.env`.

RPC is the HTTP endpoint used by the application to read from and write to blockchain nodes.

```bash
cp .env.example .env
pnpm preflight
```

After preflight checks pass, start the service process, frontend, and Injective real on-chain flow scripts.

## Production Positioning

ProofMarket's product loop is designed around production use cases: authorization, escrow, delivery, verification, challenge, settlement, and reputation updates all map to explicit on-chain or server-side states. This repository provides a testnet deployment, test source corpus, and reproducible flow scripts to validate the same production flow. With production source integrations, production payment assets, and production-grade Providers, ProofMarket can operate as a real AI service transaction and source delivery market.

---

## 中文

ProofMarket 是面向 AI Agent 的可信专业证据网络。

当 AI Agent 需要权威资料来支撑严肃的研究、分析或判断时，ProofMarket 可以帮助它找到相关资料，并对资料来源、引用内容和覆盖范围进行核查。

ProofMarket 交付的不是无法核对的建议，而是可复查的资料结果：结论、来源定位、限长摘录、证据哈希和交付记录。AI Agent 可以在用户授权的预算内，委托具备专业资料访问能力的服务方，也就是 Provider，完成资料查找、整理和核查。

## 核心机制

ProofMarket 已接入 Injective 测试网：我们在 Injective 测试网上部署了任务资金托管、挑战仲裁和基于 ERC-8004 的 Agent 身份与信誉登记合约。

ERC-8004 是一组用于登记 Agent 身份和信誉记录的链上接口约定。ProofMarket 基于这一思路，在 Injective 测试网上部署了自己的身份与信誉登记合约，用于记录 Provider 的链上身份、任务反馈和服务信誉。

用户提交任务后，预算会进入链上托管合约；Provider 提交结果后，系统可以完成付款结算；如果结果被质疑，则会进入挑战流程，由陪审节点投票并触发退款、扣罚和信誉更新。

整体上，ProofMarket 把 AI 服务交付过程中的付款、争议处理和信誉记录放到了 Injective 测试网上执行。

## 为什么需要 ProofMarket

高质量专业资料很难生产，但很多错误可以被抽查发现。

ProofMarket 利用这一点建立激励机制：Provider 先交付可追溯的资料结果，系统允许用户或核验方事后抽查。如果 Provider 编造来源、遗漏关键资料或提交低质量结果，被挑战成功后会被扣罚；如果交付质量过关，则正常获得付款。

这让专业资料服务从“相信对方说得对”变成“可以付费、可以复查、可以挑战、可以结算”的链上流程。

## 产品流程

1. 用户提交研究问题和预算。
2. 系统生成采购计划，推荐合适的 Provider。
3. 用户授权任务级支付策略。
4. 预算进入链上资金托管合约。
5. Provider 交付资料结果，并提交链上交付记录。
6. 系统或核验方检查交付质量。
7. 如果没有争议，资金结算给 Provider。
8. 如果出现争议，进入挑战仲裁流程。
9. 陪审节点投票后，合约执行退款、扣罚、奖励分配和信誉更新。

## Injective 集成

ProofMarket 当前部署在 Injective 测试网，EVM chain ID 为 `1439`。合约、任务状态和交易链接都围绕 Injective 测试网配置，前端也会把链上地址和交易哈希指向 Injective 测试网浏览器。

当前 Injective 测试网部署包括：

| 模块 | 说明 |
|---|---|
| 资金托管合约 | 管理任务预算、交付状态和最终结算 |
| 挑战仲裁合约 | 管理挑战押金、Provider 应辩、陪审投票、退款和扣罚 |
| Agent 身份合约 | 基于 ERC-8004 思路登记 Provider 身份 |
| Agent 信誉合约 | 记录任务反馈和 Provider 信誉 |
| 支付资产接口 | 支撑任务预算、Provider 质押、挑战押金和结算 |
| Injective 浏览器链接 | 前端将交易哈希和合约地址连接到 Injective 测试网浏览器 |

当前测试网部署使用 ProofMarket 在 Injective 测试网上自部署的测试 USDC 合约来承载任务预算、质押和挑战押金；交易手续费使用 Injective 测试网资产 INJ。生产部署时，支付资产可以替换为正式稳定币或项目指定的结算资产。

Injective 测试网部署信息记录在 `deployments/injective.json`。

## 产品能力

ProofMarket 面向真实 AI 服务交易场景设计，核心能力覆盖交付前授权、交付中托管、交付后核验，以及争议发生时的链上仲裁。

| 能力 | 说明 |
|---|---|
| 可验证交付 | Provider 交付可追溯资料结果，系统记录交付哈希、来源定位和核验结果 |
| 链上托管结算 | 用户预算进入托管合约，满足结算条件后再支付给 Provider |
| 挑战仲裁 | 用户质疑交付质量时，进入陪审投票并触发退款、扣罚或正常放款 |
| 信誉更新 | 任务结果会写入 Agent 身份与信誉登记合约，形成可复用的服务记录 |
| 受限授权 | 受限签名器只签署当前任务授权范围内的合约调用，超出目标合约、额度或交易次数的请求会被拒绝 |

受限签名器是策略签名模块。它把“用户授权”落实为可检查的交易边界，避免 AI Agent 获得不受限制的钱包权限。

## 仓库结构

| 路径 | 内容 |
|---|---|
| `apps/web` | ProofMarket 控制台前端 |
| `packages/contracts` | 资金托管、挑战仲裁、测试代币、身份与信誉合约 |
| `packages/backend` | 任务状态机与真实链上执行编排 |
| `packages/agents` | 规划、资料服务和核验 Agent |
| `packages/services` | Provider 提交、应辩和陪审投票服务 |
| `packages/chain` | 链上读写工具 |
| `packages/policy-signer` | 受限签名器 |
| `packages/shared` | 共享类型、测试数据、网络配置 |
| `deployments/injective.json` | Injective 测试网部署信息 |

## 本地运行

```bash
pnpm install
pnpm dev
```

打开：

```text
http://localhost:3000
```

## 测试与构建

```bash
pnpm test
pnpm build
```

## 流程脚本

```bash
pnpm demo:success
pnpm demo:challenge
pnpm demo:denial
```

## 真实链上模式

真实链上模式默认连接 Injective 测试网，执行真实合约调用。运行前需要配置 `.env` 中的测试网私钥、Provider 地址、受限签名器地址和 Injective 节点访问地址。

链节点访问地址通常叫 RPC，也就是应用读写区块链节点的 HTTP 入口。

```bash
cp .env.example .env
pnpm preflight
```

确认检查通过后，可以分别启动服务端、前端和 Injective 真实链上流程脚本。

## 生产化定位

ProofMarket 的产品闭环按实际生产场景设计：授权、托管、交付、核验、挑战、结算和信誉更新都对应明确的链上或服务端状态。当前仓库提供测试网部署、测试资料库和可复现的流程脚本，用于验证同一套生产流程。接入正式资料源、正式支付资产和生产级 Provider 后，ProofMarket 可以作为真实 AI 服务交易和资料交付市场运行。
