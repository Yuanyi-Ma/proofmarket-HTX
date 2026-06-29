import {
  generateProcurementPlan,
  runProvider as runProviderAgent,
  verifyPackage
} from "@proofmarket/agents/src";
import { buildPolicySignerPolicy } from "@proofmarket/policy-signer/src";
import { createAuditEvent } from "@proofmarket/shared/src/audit";
import {
  demoEscrowTxHashes,
  getPresetChallengeDocument,
  getPresetCounterEvidence,
  getPresetDefense,
  getProviderProfiles,
  presetJuryVotes
} from "@proofmarket/shared/src/fixtures";
import { stableHash } from "@proofmarket/shared/src/hash";
import { normalizeLocale, type Locale } from "@proofmarket/shared/src/locale";
import { assertTransition } from "@proofmarket/shared/src/stateMachine";
import type {
  AuditEvent,
  AuditResult,
  AuditSource,
  PolicySummary,
  ProviderId,
  Task,
  TaskStatus
} from "@proofmarket/shared/src/types";
import type { TxRecord } from "@proofmarket/shared/src/realMode";
import { appendAudit } from "./auditStore";
import type { InMemoryStore } from "./demoStore";

export type TaskService = {
  getTask(id: string): Promise<Task>;
  listTasks(): Promise<Task[]>;
  createTask(question: string, budget: string, locale?: Locale): Promise<Task>;
  plan(id: string): Promise<Task>;
  submitPolicy(id: string): Promise<Task>;
  activatePolicy(id: string): Promise<Task>;
  executeEscrow(id: string, providerId?: ProviderId): Promise<Task>;
  triggerDenial(id: string): Promise<Task>;
  runProvider(id: string, providerId: ProviderId): Promise<Task>;
  verify(id: string): Promise<Task>;
  settle(id: string): Promise<Task>;
  /** User rating after settlement (1-5); publishes on-chain reputation feedback in real mode. */
  rate(id: string, score: number): Promise<Task>;
  openChallenge(id: string): Promise<Task>;
  winChallenge(id: string): Promise<Task>;
  refundOrSlash(id: string): Promise<Task>;
};

const FIXTURE_ESCROW_TXS = [
  { label: "approve", txHash: demoEscrowTxHashes.approve },
  { label: "createJob", txHash: demoEscrowTxHashes.createJob },
  { label: "setBudget", txHash: demoEscrowTxHashes.setBudget },
  { label: "fund", txHash: demoEscrowTxHashes.fund }
] as const;

function fixtureActionDelayMs(): number {
  const raw = process.env.PROOFMARKET_FIXTURE_ACTION_DELAY_MS;
  if (raw !== undefined) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000;
  }
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return 0;
  return 5000;
}

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function fixtureEscrowTxRecords(taskId: string): TxRecord[] {
  return FIXTURE_ESCROW_TXS.map(({ label, txHash }) => ({
    label,
    policySignerRequestId: `fixture-${taskId}-${label}`,
    txHash,
    status: "confirmed"
  }));
}

export function createTaskService(store: InMemoryStore): TaskService {
  let taskCounter = 0;
  let auditCounter = 0;
  const fixtureDelayMs = fixtureActionDelayMs();

  function now(): string {
    return new Date().toISOString();
  }

  function nextId(prefix: string, counter: number): string {
    return `${prefix}_${counter.toString().padStart(3, "0")}`;
  }

  function nextTaskId(): string {
    taskCounter += 1;
    return nextId("task", taskCounter);
  }

  function nextAuditId(): string {
    auditCounter += 1;
    return nextId("audit", auditCounter);
  }

  function audit(input: {
    taskId: string;
    source: AuditSource;
    type: string;
    result: AuditResult;
    message: string;
    txHash?: string | null;
    policyId?: string | null;
    jobId?: number | null;
  }): AuditEvent {
    return createAuditEvent({
      id: nextAuditId(),
      createdAt: now(),
      ...input
    });
  }

  function save(task: Task): Task {
    return store.saveTask(task);
  }

  function transition(task: Task, status: TaskStatus): Task {
    assertTransition(task.status, status);
    return {
      ...task,
      status,
      updatedAt: now()
    };
  }

  function withAudit(task: Task, event: AuditEvent): Task {
    return appendAudit(task, event);
  }

  function policyFor(task: Task): PolicySummary {
    const policy = buildPolicySignerPolicy({
      escrowAddress: "ProofMarketEscrow",
      tokenAddress: "MockUSDC",
      challengeManagerAddress: "ProofMarketChallengeManager"
    });

    return {
      intent: `Fund one provider research job for task ${task.id}.`,
      totalBudget: policy.totalBudget,
      perJobCap: task.plan?.perJobCap ?? policy.perJobCap,
      allowedTargets: policy.allowedTargets,
      allowedFunctions: policy.allowedFunctions,
      denyRules: policy.denyRules,
      expiresInMinutes: policy.expiresInMinutes,
      policyId: `policy_${task.id.slice("task_".length)}`,
      status: "submitted"
    };
  }

  return {
    async getTask(id: string): Promise<Task> {
      return store.getTask(id);
    },

    async listTasks(): Promise<Task[]> {
      return store.listTasks();
    },

    async createTask(question: string, budget: string, localeInput: Locale = "en"): Promise<Task> {
      const timestamp = now();
      const id = nextTaskId();
      const locale = normalizeLocale(localeInput);
      const task: Task = {
        id,
        userQuestion: question,
        locale,
        status: "Created",
        budgetLimit: budget,
        selectedProviderIds: [],
        plan: null,
        policy: null,
        providerPackage: null,
        audit: [],
        jobId: null,
        mode: "fixture",
        txRecords: [],
        claudePlanRaw: null,
        denial: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      return save(
        withAudit(
          task,
          audit({
            taskId: id,
            source: "user",
            type: "task_created",
            result: "success",
            message:
              locale === "zh"
                ? `用户创建任务，预算 ${budget}。`
                : `User created the task with a ${budget} budget.`
          })
        )
      );
    },

    async plan(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      const plan = generateProcurementPlan(
        task.id,
        task.userQuestion,
        locale
      );
      const profiles = getProviderProfiles(locale);
      const selectedProviderIds = profiles.map((provider) => provider.id);
      const planned = transition(
        {
          ...task,
          plan,
          selectedProviderIds
        },
        "Planned"
      );

      return save(
        withAudit(
          planned,
          audit({
            taskId: id,
            source: "research-agent",
            type: "procurement_plan_created",
            result: "success",
            message:
              locale === "zh"
                ? `已选定候选 Provider：${selectedProviderIds.join("、")}。`
                : `Selected provider candidates: ${selectedProviderIds.join(", ")}.`
          })
        )
      );
    },

    async submitPolicy(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      const policy = policyFor(task);
      const submitted = transition(
        {
          ...task,
          policy
        },
        "PolicySubmitted"
      );

      return save(
        withAudit(
          submitted,
          audit({
            taskId: id,
            source: "policy-signer",
            type: "policy_submitted",
            result: "success",
            message:
              locale === "zh"
                ? `已提交受限签名策略 ${policy.policyId}。`
                : `Submitted Policy Signer policy ${policy.policyId}.`,
            policyId: policy.policyId
          })
        )
      );
    },

    async activatePolicy(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      if (!task.policy) {
        throw new Error("Cannot activate policy before submission");
      }
      const policy: PolicySummary = {
        ...task.policy,
        status: "active"
      };
      const activated = transition(
        {
          ...task,
          policy
        },
        "PolicyActive"
      );

      return save(
        withAudit(
          activated,
          audit({
            taskId: id,
            source: "policy-signer",
            type: "policy_activated",
            result: "success",
            message:
              locale === "zh"
                ? `受限签名策略 ${policy.policyId} 已激活。`
                : `Policy Signer policy ${policy.policyId} is active.`,
            policyId: policy.policyId
          })
        )
      );
    },

    async executeEscrow(id: string, providerId?: ProviderId): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      const selectedProviderId = providerId ?? task.plan?.recommendedProviderId ?? null;
      const txRecords = fixtureEscrowTxRecords(id);
      const funded = transition(
        {
          ...task,
          selectedProviderId,
          jobId: 1,
          txRecords
        },
        "JobFunded"
      );

      return save(
        withAudit(
          funded,
          audit({
            taskId: id,
            source: "policy-signer",
            type: "escrow_executed",
            result: "success",
            message:
              locale === "zh"
                ? "四笔采购交易已按受限签名策略确认：approve / createJob / setBudget / fund。"
                : "Four purchase transactions were confirmed under the Policy Signer boundary: approve / createJob / setBudget / fund.",
            txHash: txRecords.at(-1)?.txHash ?? null,
            policyId: task.policy?.policyId ?? null,
            jobId: 1
          })
        )
      );
    },

    async triggerDenial(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      const denial = {
        denied: true as const,
        exitCode: 403,
        attemptedAction: "transfer 10 SETH to 0xDeniedDirectTransfer",
        rawOutput:
          locale === "zh"
            ? "POLICY_SIGNER_DENY: 直接转账被拒绝：目标地址不在白名单内，且金额超出 Policy 上限。"
            : "POLICY_SIGNER_DENY: direct transfer rejected because the target is outside the allowlist and the amount exceeds the policy cap."
      };
      const denied = transition({ ...task, denial }, "DeniedByPolicy");

      return save(
        withAudit(
          denied,
          audit({
            taskId: id,
            source: "policy-signer",
            type: "escrow_denied",
            result: "denied",
            message:
              locale === "zh"
                ? `${denial.rawOutput} 尝试目标=0xDeniedDirectTransfer；函数=transfer；金额=10 SETH；已转移资金=0 test USDC；未创建任何托管订单。`
                : `${denial.rawOutput} attemptedTarget=0xDeniedDirectTransfer; function=transfer; amount=10 SETH; fundsMoved=0 test USDC; no escrow order was created.`,
            policyId: task.policy?.policyId ?? null
          })
        )
      );
    },

    async runProvider(id: string, providerId: ProviderId): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      const selectedProviderId = task.selectedProviderId ?? task.plan?.recommendedProviderId ?? null;
      if (selectedProviderId && providerId !== selectedProviderId) {
        throw new Error(
          `Provider mismatch: job was funded for ${selectedProviderId}, cannot run ${providerId}`
        );
      }
      const providerPackage = runProviderAgent(task.id, providerId, locale);
      const delivered = transition(
        {
          ...task,
          providerPackage
        },
        "Delivered"
      );

      return save(
        withAudit(
          delivered,
          audit({
            taskId: id,
            source: "provider",
            type: "provider_package_delivered",
            result: "success",
            message:
              locale === "zh"
                ? `Provider ${providerId} 交付证据服务包 ${providerPackage.packageHash}。`
                : `Provider ${providerId} delivered Evidence Service Package ${providerPackage.packageHash}.`,
            jobId: task.jobId
          })
        )
      );
    },

    async verify(id: string): Promise<Task> {
      const task = store.getTask(id);
      if (!task.providerPackage || task.status !== "Delivered") {
        throw new Error("Cannot verify before provider delivery");
      }

      const locale = normalizeLocale(task.locale);
      const verdict = verifyPackage(task.providerPackage, locale);
      const nextStatus: TaskStatus =
        verdict.verdict === "valid" ? "Verified" : "Challenged";
      const verified = transition(task, nextStatus);
      const result = verdict.verdict === "valid" ? "success" : "failed";

      return save(
        withAudit(
          verified,
          audit({
            taskId: id,
            source: "verifier",
            type:
              verdict.verdict === "valid"
                ? "verification_passed"
                : "verification_failed",
            result,
            message: `${verdict.reason} resultHash=${verdict.resultHash}`,
            jobId: task.jobId
          })
        )
      );
    },

    async settle(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      const settled = transition(task, "Settled");

      return save(
        withAudit(
          settled,
          audit({
            taskId: id,
            source: "settlement",
            type: "settled",
            result: "success",
            message:
              locale === "zh"
                ? "已向 Provider 结算付款。"
                : "Payment was settled to the Provider.",
            jobId: task.jobId
          })
        )
      );
    },

    async rate(id: string, score: number): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      if (task.status !== "Settled" && task.status !== "Audited") {
        throw new Error("Cannot rate before settlement");
      }
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error("score must be an integer in 1-5");
      }
      if (task.audit.some((e) => e.type === "reputation_feedback_published")) {
        throw new Error("This task has already been rated");
      }
      return save(
        withAudit(
          task,
          audit({
            taskId: id,
            source: "user",
            type: "reputation_feedback_published",
            result: "success",
            message:
              locale === "zh"
                ? `用户评分 ${score}/5，已记入 Provider 信誉（本地模拟）。`
                : `User rating ${score}/5 was recorded in Provider reputation (local simulation).`,
            jobId: task.jobId
          })
        )
      );
    },

    // Explicit user-initiated challenge: Delivered → Challenged only. Verified
    // is deliberately NOT a legal entry point — once the verifier accepted the
    // package, the demo settles; the user challenge targets the freshly
    // delivered package (spec 08 "确定性挑战流程" step 1).
    async openChallenge(id: string): Promise<Task> {
      await delay(fixtureDelayMs);
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      if (task.status !== "Delivered") {
        throw new Error("Cannot open a challenge before evidence delivery");
      }

      const presetCounterEvidence = getPresetCounterEvidence(locale);
      const presetChallengeDocument = getPresetChallengeDocument(locale);
      const presetDefense = getPresetDefense(locale);
      const counterEvidenceHash = stableHash(presetCounterEvidence);
      let challenged = transition(
        {
          ...task,
          challenge: {
            type: "CoverageMiss" as const,
            statement: presetChallengeDocument.statement,
            hitCoverageClause: presetChallengeDocument.hitCoverageClause,
            counterEvidenceHash
          }
        },
        "Challenged"
      );

      challenged = withAudit(
        challenged,
        audit({
          taskId: id,
            source: "user",
            type: "challenge_opened",
            result: "success",
            message:
              locale === "zh"
                ? `用户发起挑战：类型 CoverageMiss，反证哈希 ${counterEvidenceHash}。挑战押金与陪审费已锁定，托管订单已冻结，Provider 应辩窗口开启。陪审方指派：${presetChallengeDocument.juryAssignmentBasis}`
                : `User opened a CoverageMiss challenge with counter-evidence hash ${counterEvidenceHash}. The challenge deposit and jury fee are locked, the escrow order is frozen, and the Provider defense window is open. Jury assignment: ${presetChallengeDocument.juryAssignmentBasis}`,
          jobId: task.jobId
        })
      );

      // Preset defense, mirroring the real flow's auto-filed 应辩书.
      return save(
        withAudit(
          {
            ...challenged,
            challenge: { ...challenged.challenge!, defense: { ...presetDefense } }
          },
          audit({
            taskId: id,
            source: "provider",
            type: "defense_submitted",
            result: "success",
            message:
              locale === "zh"
                ? `Provider 已在应辩窗口内提交应辩书（哈希 ${presetDefense.defenseHash}）：${presetDefense.statement}`
                : `Provider submitted a Defense Statement within the defense window (hash ${presetDefense.defenseHash}): ${presetDefense.statement}`,
            jobId: task.jobId
          })
        )
      );
    },

    async winChallenge(id: string): Promise<Task> {
      await delay(fixtureDelayMs);
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      // Preset jury verdict (陪审团确定性裁决): 2:1 ProviderFault, fixture
      // juror addresses (no chain in fixture mode).
      const votes = presetJuryVotes([
        "0x0000000000000000000000000000000000000a01",
        "0x0000000000000000000000000000000000000a02",
        "0x0000000000000000000000000000000000000a03"
      ], locale);
      const faultVotes = votes.filter((vote) => vote.vote === "ProviderFault").length;

      let current = task.challenge
        ? // The verify() fault auto-route reaches Challenged without an explicit
          // challenge record; only attach the votes when a challenge exists.
          { ...task, challenge: { ...task.challenge, votes } }
        : task;
      for (const vote of votes) {
        current = withAudit(
          current,
          audit({
            taskId: id,
            source: "verifier",
            type: "jury_vote",
            result: "success",
            message:
              locale === "zh"
                ? `陪审方 ${vote.jurorAddress.slice(0, 10)}… 投票 ${vote.vote}（${vote.reasonCode}），理由书哈希 ${vote.reasonHash}。结论：${vote.reasonBook.conclusion}`
                : `Juror ${vote.jurorAddress.slice(0, 10)}... voted ${vote.vote} (${vote.reasonCode}); reason-book hash ${vote.reasonHash}. Conclusion: ${vote.reasonBook.conclusion}`,
            jobId: task.jobId
          })
        );
      }
      const won = transition(current, "ChallengeWon");

      return save(
        withAudit(
          won,
          audit({
            taskId: id,
            source: "verifier",
            type: "challenge_won",
            result: "success",
            message:
              locale === "zh"
                ? `陪审团多数决 ${faultVotes}:${votes.length - faultVotes} 判 ProviderFault，挑战成立。`
                : `Jury majority ${faultVotes}:${votes.length - faultVotes} found ProviderFault; the challenge is upheld.`,
            jobId: task.jobId
          })
        )
      );
    },

    async refundOrSlash(id: string): Promise<Task> {
      await delay(fixtureDelayMs);
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      const refunded = transition(task, "RefundedOrSlashed");

      return save(
        withAudit(
          refunded,
          audit({
            taskId: id,
            source: "settlement",
            type: "refund_or_slash",
            result: "success",
            message:
              locale === "zh"
                ? "已执行裁决资金动作：扣除 Provider 质押 50%（挑战者得一半作奖励），托管资金退款买方，挑战者押金与陪审费退回，陪审费由扣罚承担、陪审团均分，余额归入金库。"
                : "Verdict funds were executed: 50% of the Provider bond was slashed, half of the slash rewards the challenger, escrowed funds return to the buyer, the challenge deposit and jury fee are returned, the jury fee is paid from the slash and split across jurors, and the remainder goes to the treasury.",
            jobId: task.jobId
          })
        )
      );
    }
  };
}
