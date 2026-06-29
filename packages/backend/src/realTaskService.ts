import {
  ChallengeType,
  encodeApprove,
  encodeComplete,
  encodeCreateJob,
  encodeFund,
  encodeOpenChallenge,
  encodeSetBudget
} from "@proofmarket/chain/src/calldata";
import { buildRealPolicySubmission } from "@proofmarket/policy-signer/src/policy";
import { createAuditEvent } from "@proofmarket/shared/src/audit";
import { getProofMarketNetworkByChainId } from "@proofmarket/shared/src/chains";
import {
  getPresetChallengeDocument,
  getPresetCounterEvidence,
  getProviderProfiles
} from "@proofmarket/shared/src/fixtures";
import { stableHash } from "@proofmarket/shared/src/hash";
import { normalizeLocale, type Locale } from "@proofmarket/shared/src/locale";
import type {
  PolicyDenialRecord,
  DeploymentArtifact,
  ResearchPlanOutput,
  TxRecord
} from "@proofmarket/shared/src/realMode";
import { assertTransition } from "@proofmarket/shared/src/stateMachine";
import type {
  AuditEvent,
  AuditResult,
  AuditSource,
  JuryVote,
  PolicySummary,
  ProcurementPlan,
  ProviderAnswerPackage,
  ProviderId,
  ProviderReputation,
  Task,
  TaskStatus
} from "@proofmarket/shared/src/types";
import type { InMemoryStore } from "./demoStore";
import type { TaskService } from "./taskService";

export type RealDeps = {
  deployment: DeploymentArtifact;
  providerAddress: string;
  runResearchAgent(context: {
    taskId: string;
    question: string;
    budgetAmount: string;
    providerCatalog: Array<{
      providerId: string;
      displayName: string;
      specialties: string[];
      price: string;
    }>;
    policySummary: string;
  }): Promise<{ plan: ResearchPlanOutput; rawStdout: string; attempts: number; agentName?: string }>;
  policySigner: {
    submitPolicy(submission: unknown): Promise<{ policyId: string; status: string; raw: string }>;
    getPolicyStatus(policyId: string): Promise<{ policyId: string; status: string; raw: string }>;
    callContract(input: {
      policyId: string;
      contract: string;
      calldata: string;
      requestId: string;
      description: string;
    }): Promise<{ policySignerRequestId: string; status: string; raw: string }>;
    getTx(policySignerRequestId: string): Promise<{ raw: string; parsed: Record<string, unknown> }>;
    attemptDeniedTransfer(input: {
      policyId: string;
      dstAddress: string;
      amount: string;
    }): Promise<PolicyDenialRecord>;
  };
  chain: {
    waitForReceipt(
      txHash: `0x${string}`
    ): Promise<{ logs: unknown[]; transactionHash: string }>;
    extractJobId(receipt: unknown, escrowAddress: string): bigint;
    extractChallengeId(receipt: unknown, challengeManagerAddress: string): bigint;
    readJobState(
      escrowAddress: `0x${string}`,
      jobId: bigint
    ): Promise<{ state: number; budget: bigint; deliverableHash: `0x${string}` }>;
    readProviderStake(
      challengeManagerAddress: `0x${string}`,
      providerAddress: `0x${string}`
    ): Promise<{ stake: bigint; lockedStake: bigint; minStake: bigint; freeStake: bigint }>;
  };
  /**
   * Executes ChallengeManager.resolve(challengeId) with the backend's resolver
   * key. v2: permissionless majority execution — the outcome comes from the
   * on-chain juror votes, not from this call. Does NOT go through PolicySigner.
   */
  resolveChallenge(input: { challengeId: bigint }): Promise<{ txHash: string }>;
  /**
   * Publishes ERC-8004 reputation feedback signed directly by the rater key
   * (PROVIDER_SIGNER — must NOT be the agent owner), not PolicySigner. `value` is on
   * the 0-500 raw scale (valueDecimals 2 → 500 = 5.00/5.00).
   */
  publishFeedback(input: {
    agentId: number;
    value: number;
    tag2: string;
  }): Promise<{ txHash: string }>;
  /**
   * Reads the ERC-8004 reputation summary for an agent, already mapped to the
   * fixture 0-1000 display scale. Throws on RPC failure or when the agent has
   * no on-chain feedback — the caller falls back to the fixture score.
   */
  readReputation(agentId: number): Promise<{ score: number }>;
  services: {
    runProvider(input: {
      taskId: string;
      jobId: string;
      providerId: ProviderId;
      question: string;
      locale?: Locale;
    }): Promise<ProviderAnswerPackage>;
    submitDeliverable(input: {
      providerId: ProviderId;
      jobId: string;
      deliverableHash: string;
    }): Promise<{ txHash: string }>;
    judgeVerify(input: {
      taskId: string;
      jobId: string;
      evidencePackageHash: string;
      evidencePackage: unknown;
      successCriteria: string[];
      locale?: Locale;
    }): Promise<{
      judgeId: string;
      jobId: string;
      decision: "valid" | "provider_fault";
      reasonCode: string;
      verdictHash: string;
      voting: { mode: string; voteId: string | null; onchainTxHash: string | null };
    }>;
    /**
     * Provider's defense filing (preset content, real provider-signed
     * submitDefense tx). Returns the plaintext for the audit/UI layer.
     */
    providerDefend(input: { providerId: ProviderId; challengeId: string; locale?: Locale }): Promise<{
      statement: string;
      defenseHash: string;
      txHash: string;
    }>;
    /**
     * The jury panel: waits out the defense window R_w, then casts three real
     * castVote transactions (preset 2:1 verdict) and returns the reasoned
     * votes in casting order.
     */
    juryVote(input: { challengeId: string; openedAtMs: number; locale?: Locale }): Promise<{
      votes: (JuryVote & { txHash: string })[];
    }>;
  };
  audit: { append(taskId: string, event: unknown): void };
  now(): string;
  pollDelayMs?: number; // injectable; 0 in tests, ~5000 in prod
};

const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const MAX_TX_POLLS = 60;
const FAILED_TX_STATUSES = new Set(["failed", "rejected", "denied"]);

// ERC-8004 feedback values, valueDecimals=2 (500 → 5.00 on a 0-5 scale).
const FEEDBACK_POSITIVE_VALUE = 500; // job settled successfully
const FEEDBACK_NEGATIVE_VALUE = 100; // challenge upheld against the provider

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text: string, maxLength = 300): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}…`;
}

/** "5 test USDC" -> "5"; "0.5 mUSDC" -> "0.5" */
function leadingDecimal(budgetLimit: string): string {
  const match = budgetLimit.match(/^\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error(`Cannot derive a budget amount from "${budgetLimit}"`);
  }
  return match[1];
}

function formatToken(raw: bigint, symbol: string): string {
  const sign = raw < 0n ? "-" : "";
  const value = raw < 0n ? -raw : raw;
  const whole = value / 1_000_000n;
  const fractional = (value % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${sign}${whole}${fractional ? `.${fractional}` : ""} ${symbol}`;
}

export function createRealTaskService(store: InMemoryStore, deps: RealDeps): TaskService {
  let taskCounter = 0;
  let auditCounter = 0;
  // Per-instance suffix so requestIds stay unique across process restarts:
  // a restarted server replays task/attempt counters from zero, and PolicySigner
  // deduplicates by requestId — a reused id would silently drop the call.
  const instanceSuffix = Date.now().toString(36);
  // Judge verdict hashes live only between verify() and settle() in one process.
  const verdicts = new Map<string, string>();
  // Wall-clock time openChallenge confirmed, per task — the jury service uses
  // it to sleep out the defense window R_w before casting votes.
  const challengeOpenedAt = new Map<string, number>();
  // Re-entry guard: task ids with a money-moving operation currently in flight.
  const inFlight = new Set<string>();

  const escrowAddress = deps.deployment.contracts.ProofMarketEscrow as `0x${string}`;
  const tokenAddress = (deps.deployment.paymentToken?.address ??
    deps.deployment.contracts.MockUSDC) as `0x${string}`;
  const network = getProofMarketNetworkByChainId(deps.deployment.chainId);
  const assetSymbol = deps.deployment.paymentToken?.symbol ?? network.assetSymbol;
  const pollDelayMs = deps.pollDelayMs ?? 5000;
  // Challenge window W_c (escrow complete gate), in ms. 0 when the artifact
  // predates v2 — then no gating is applied client-side either.
  const challengeWindowMs =
    Number(deps.deployment.escrowParams?.challengeWindow ?? 0) * 1000;

  function formatPayment(raw: bigint): string {
    return formatToken(raw, assetSymbol);
  }

  function resolveJobProvider(task: Task, requestedProviderId?: ProviderId): {
    providerId: ProviderId;
    address: `0x${string}`;
    agentId: bigint;
  } {
    const providerId =
      requestedProviderId ?? task.selectedProviderId ?? task.plan?.recommendedProviderId ?? null;
    if (!providerId) {
      throw new Error("Cannot resolve Provider before a procurement plan exists");
    }

    const artifactEntry = deps.deployment.providers?.[providerId];
    const fallbackAddress =
      providerId === "execution-research-expert" ? deps.providerAddress : undefined;
    const address = artifactEntry?.address ?? fallbackAddress;
    if (!address) {
      throw new Error(
        `Provider ${providerId} has no address in the deployment artifact; cannot create a real on-chain job for it`
      );
    }

    const profileAgentId = getProviderProfiles(normalizeLocale(task.locale)).find(
      (profile) => profile.id === providerId
    )?.agentId;
    const agentId = artifactEntry?.agentId ?? profileAgentId;
    if (agentId == null) {
      throw new Error(
        `Provider ${providerId} has no ERC-8004 agentId in the deployment artifact or fixture profile`
      );
    }

    return {
      providerId,
      address: address as `0x${string}`,
      agentId: BigInt(agentId)
    };
  }

  function nextId(prefix: string, counter: number): string {
    return `${prefix}_${counter.toString().padStart(3, "0")}`;
  }

  function nextTaskId(): string {
    taskCounter += 1;
    return nextId("task", taskCounter);
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
    auditCounter += 1;
    return createAuditEvent({
      id: nextId("audit", auditCounter),
      createdAt: deps.now(),
      ...input
    });
  }

  /** Appends to the task's audit array AND mirrors to the external audit sink. */
  function withAudit(task: Task, event: AuditEvent): Task {
    deps.audit.append(task.id, event);
    return {
      ...task,
      audit: [...task.audit, event],
      updatedAt: deps.now()
    };
  }

  function save(task: Task): Task {
    return store.saveTask(task);
  }

  /** Status gate: every method calls this FIRST, before any external side effect. */
  function assertStatus(task: Task, expected: TaskStatus[], action: string): void {
    if (!expected.includes(task.status)) {
      throw new Error(`cannot ${action} from status ${task.status}`);
    }
  }

  function transition(task: Task, status: TaskStatus): Task {
    assertTransition(task.status, status);
    return {
      ...task,
      status,
      updatedAt: deps.now()
    };
  }

  /**
   * Publishes ERC-8004 reputation feedback for the provider that ran the job,
   * after the settlement outcome is already final.
   *
   * Failure policy (documented design choice): feedback is a post-settlement
   * record, NOT part of the fund movement — if publishing fails (or the
   * provider has no agentId in the artifact), we record a failed/skipped audit
   * entry and return the task unchanged in status. No-fabrication still holds:
   * only a real txHash is ever recorded, and a failure never invents one.
   */
  async function publishReputationFeedback(
    task: Task,
    input: { value: number; tag2: string; sentiment: string }
  ): Promise<Task> {
    const locale = normalizeLocale(task.locale);
    // The provider that actually ran the job (not necessarily the recommended one).
    const providerId =
      task.providerPackage?.providerId ??
      task.selectedProviderId ??
      task.plan?.recommendedProviderId ??
      null;
    const agentId = providerId
      ? deps.deployment.providers?.[providerId]?.agentId
      : undefined;
    if (agentId == null) {
      // Graceful skip: provider not registered on ERC-8004 — note it, move on.
      return save(
        withAudit(
          task,
          audit({
            taskId: task.id,
            source: "chain",
            type: "reputation_feedback_skipped",
            result: "failed",
            message:
              locale === "zh"
                ? `未发布链上信誉反馈（${input.sentiment}）：Provider ${providerId ?? "未知"} 在部署 artifact 中没有 ERC-8004 agentId（非致命，结算结果不受影响）。`
                : `Skipped on-chain reputation feedback (${input.sentiment}): Provider ${providerId ?? "unknown"} has no ERC-8004 agentId in the deployment artifact (non-fatal; settlement is unaffected).`,
            jobId: task.jobId
          })
        )
      );
    }

    try {
      const { txHash } = await deps.publishFeedback({
        agentId,
        value: input.value,
        tag2: input.tag2
      });
      const record: TxRecord = {
        label: "feedback",
        policySignerRequestId: null,
        txHash,
        status: "confirmed"
      };
      return save(
        withAudit(
          { ...task, txRecords: [...task.txRecords, record], updatedAt: deps.now() },
          audit({
            taskId: task.id,
            source: "chain",
            type: "reputation_feedback_published",
            result: "success",
            message:
              locale === "zh"
                ? `已发布链上信誉反馈（${input.sentiment}）：agentId ${agentId}，分值 ${(input.value / 100).toFixed(2)}/5.00，标签 ${input.tag2}。`
                : `Published on-chain reputation feedback (${input.sentiment}): agentId ${agentId}, score ${(input.value / 100).toFixed(2)}/5.00, tag ${input.tag2}.`,
            txHash,
            jobId: task.jobId
          })
        )
      );
    } catch (error) {
      const failedRecord: TxRecord = {
        label: "feedback",
        policySignerRequestId: null,
        txHash: "",
        status: "failed"
      };
      return save(
        withAudit(
          { ...task, txRecords: [...task.txRecords, failedRecord], updatedAt: deps.now() },
          audit({
            taskId: task.id,
            source: "chain",
            type: "reputation_feedback_failed",
            result: "failed",
            message:
              locale === "zh"
                ? `链上信誉反馈（${input.sentiment}）发布失败（非致命，结算结果不受影响）：${error instanceof Error ? error.message : String(error)}`
                : `Failed to publish on-chain reputation feedback (${input.sentiment}); non-fatal and settlement is unaffected: ${error instanceof Error ? error.message : String(error)}`,
            jobId: task.jobId
          })
        )
      );
    }
  }

  function extractTxHash(parsed: Record<string, unknown>): string | null {
    const candidate = parsed.tx_hash ?? parsed.transaction_hash;
    if (typeof candidate === "string" && TX_HASH_PATTERN.test(candidate)) {
      return candidate;
    }
    return null;
  }

  function isFailedTxStatus(parsed: Record<string, unknown>): boolean {
    return (
      typeof parsed.status === "string" &&
      FAILED_TX_STATUSES.has(parsed.status.toLowerCase())
    );
  }

  function summarizePolicySignerTx(parsed: Record<string, unknown>): string {
    const fields = [
      "status",
      "sub_status",
      "code",
      "reason",
      "message",
      "request_id",
      "id",
      "transaction_hash",
      "tx_hash"
    ];
    const parts: string[] = [];
    for (const field of fields) {
      const value = parsed[field];
      if (typeof value === "string" && value) {
        parts.push(`${field}=${value}`);
      }
    }
    return parts.length > 0 ? parts.join(", ") : "no parsed failure detail";
  }

  async function assertProviderStakeAvailable(
    taskRef: { task: Task },
    provider: { providerId: ProviderId; address: `0x${string}` }
  ): Promise<void> {
    const challengeManagerAddress = deps.deployment.contracts.ProofMarketChallengeManager;
    if (!challengeManagerAddress) {
      return;
    }

    const stake = await deps.chain.readProviderStake(
      challengeManagerAddress as `0x${string}`,
      provider.address
    );
    if (stake.freeStake >= stake.minStake) return;

    const message =
      `Provider 可用质押不足（${provider.providerId}），无法创建新的托管订单：` +
      `总质押 ${formatPayment(stake.stake)}，` +
      `已锁定 ${formatPayment(stake.lockedStake)}，` +
      `可用 ${formatPayment(stake.freeStake)}，` +
      `新任务至少需要 ${formatPayment(stake.minStake)}。` +
      "请先释放未终结订单，或补充 Provider 质押后再继续。";
    taskRef.task = save(
      withAudit(
        taskRef.task,
        audit({
          taskId: taskRef.task.id,
          source: "chain",
          type: "provider_stake_insufficient",
          result: "failed",
          message,
          policyId: taskRef.task.policy?.policyId ?? null,
          jobId: taskRef.task.jobId
        })
      )
    );
    throw new Error(message);
  }

  /**
   * Executes one contract call through PolicySigner, persisting incremental progress:
   * the record is saved as pending before the call, and confirmed (or failed)
   * as soon as the chain settles it.
   */
  async function policySignerCall(
    taskRef: { task: Task },
    label: TxRecord["label"],
    contract: string,
    calldata: string
  ): Promise<{ logs: unknown[]; transactionHash: string }> {
    const policyId = taskRef.task.policy?.policyId;
    if (!policyId) {
      throw new Error("Cannot execute a PolicySigner call without a policy");
    }

    // Attempt-unique idempotency suffix: a retried label gets a new index
    // because the failed record from the previous attempt stays in txRecords.
    const attemptIndex = taskRef.task.txRecords.length;
    const pending: TxRecord = { label, policySignerRequestId: null, txHash: "", status: "pending" };
    taskRef.task = save({
      ...taskRef.task,
      txRecords: [...taskRef.task.txRecords, pending],
      updatedAt: deps.now()
    });
    const recordIndex = taskRef.task.txRecords.length - 1;

    function patchRecord(patch: Partial<TxRecord>): void {
      const txRecords = taskRef.task.txRecords.map((record, index) =>
        index === recordIndex ? { ...record, ...patch } : record
      );
      taskRef.task = save({ ...taskRef.task, txRecords, updatedAt: deps.now() });
    }

    function auditFailure(error: unknown): void {
      taskRef.task = save(
        withAudit(
          taskRef.task,
          audit({
            taskId: taskRef.task.id,
            source: "chain",
            type: "chain_tx_failed",
            result: "failed",
            message: `${label} 执行失败：${error instanceof Error ? error.message : String(error)}`,
            policyId,
            jobId: taskRef.task.jobId
          })
        )
      );
    }

    let call: { policySignerRequestId: string; status: string; raw: string };
    try {
      call = await deps.policySigner.callContract({
        policyId,
        contract,
        calldata,
        requestId: `${taskRef.task.id}-${label}-${attemptIndex}-${instanceSuffix}`,
        description: label
      });
    } catch (error) {
      patchRecord({ status: "failed" });
      auditFailure(error);
      throw error;
    }
    // Persist the PolicySigner identifier immediately so a crash mid-poll is traceable.
    patchRecord({ policySignerRequestId: call.policySignerRequestId });

    let txHash: string | null = null;
    for (let attempt = 0; attempt < MAX_TX_POLLS; attempt += 1) {
      const { parsed } = await deps.policySigner.getTx(call.policySignerRequestId);
      if (isFailedTxStatus(parsed)) {
        patchRecord({ status: "failed" });
        const error = new Error(
          `PolicySigner transaction ${call.policySignerRequestId} (${label}) failed: ${summarizePolicySignerTx(parsed)}`
        );
        auditFailure(error);
        throw error;
      }
      txHash = extractTxHash(parsed);
      if (txHash) break;
      await delay(pollDelayMs);
    }
    if (!txHash) {
      patchRecord({ status: "failed" });
      const error = new Error(
        `PolicySigner transaction ${call.policySignerRequestId} (${label}) produced no tx hash after ${MAX_TX_POLLS} polls`
      );
      auditFailure(error);
      throw error;
    }

    // Persist the tx hash before waiting for the receipt: if waitForReceipt
    // throws, the record keeps both identifiers (still pending — the tx may
    // have landed on chain).
    patchRecord({ txHash });

    let receipt: { logs: unknown[]; transactionHash: string };
    try {
      receipt = await deps.chain.waitForReceipt(txHash as `0x${string}`);
    } catch (error) {
      auditFailure(error);
      throw error;
    }

    patchRecord({ status: "confirmed" });
    taskRef.task = save(
      withAudit(
        taskRef.task,
        audit({
          taskId: taskRef.task.id,
          source: "chain",
          type: "chain_tx_confirmed",
          result: "success",
          message: `${label} 交易已在 ${network.chainName} 上确认。`,
          txHash,
          policyId,
          jobId: taskRef.task.jobId
        })
      )
    );

    return receipt;
  }

  return {
    async getTask(id: string): Promise<Task> {
      return store.getTask(id);
    },

    async listTasks(): Promise<Task[]> {
      return store.listTasks();
    },

    async createTask(question: string, budget: string, localeInput: Locale = "en"): Promise<Task> {
      const timestamp = deps.now();
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
        mode: "real",
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
      assertStatus(task, ["Created"], "plan");
      const budgetAmount = leadingDecimal(task.budgetLimit);
      const profiles = getProviderProfiles(locale);
      // Read on-chain reputation FIRST — it is a probabilistic prior the
      // research agent must weigh when recommending. A degraded read (or a
      // missing agentId) falls back to the fixture score; it must never block
      // planning. Mapped to the 0-1000 scale.
      const providerReputations: ProviderReputation[] = [];
      const reputationFallbacks: string[] = [];
      for (const profile of profiles) {
        const agentId = deps.deployment.providers?.[profile.id]?.agentId;
        if (agentId == null) {
          providerReputations.push({
            providerId: profile.id,
            score: profile.reputationScore,
            source: "fixture"
          });
          reputationFallbacks.push(
            locale === "zh"
              ? `${profile.id}（artifact 中无 agentId）`
              : `${profile.id} (missing agentId in deployment artifact)`
          );
          continue;
        }
        try {
          const { score } = await deps.readReputation(agentId);
          providerReputations.push({ providerId: profile.id, score, source: "erc8004" });
        } catch (error) {
          providerReputations.push({
            providerId: profile.id,
            score: profile.reputationScore,
            source: "fixture"
          });
          reputationFallbacks.push(
            locale === "zh"
              ? `${profile.id}（${error instanceof Error ? error.message : String(error)}）`
              : `${profile.id} (${error instanceof Error ? error.message : String(error)})`
          );
        }
      }
      const repOf = (pid: ProviderId): number | undefined =>
        providerReputations.find((r) => r.providerId === pid)?.score;

      // The catalog the agent reasons over: self-DECLARED coverage + price +
      // on-chain reputation/history. Deliberately no post-purchase facts — the
      // agent recommends on priors, the Judge verifies actual delivery later.
      const providerCatalog = profiles.map((profile) => ({
        providerId: profile.id,
        displayName: profile.name,
        specialties: [profile.coverage],
        price: profile.price,
        reputation: repOf(profile.id),
        challengeHistory:
          locale === "zh"
            ? `被挑战 ${profile.challengeStats.challenged} 次 / 成立 ${profile.challengeStats.upheld} 次`
            : `${profile.challengeStats.challenged} challenges / ${profile.challengeStats.upheld} upheld`
      }));
      const challengeManagerAddress = deps.deployment.contracts.ProofMarketChallengeManager;
      const policySummary = challengeManagerAddress
        ? "A PolicySigner policy restricts execution to the ProofMarketEscrow, payment token and " +
          `ProofMarketChallengeManager contracts on ${network.chainName}, ` +
          "with a cap of 10 transactions and a 90 minute expiry."
        : "A PolicySigner policy restricts execution to the ProofMarketEscrow and payment token " +
          `contracts on ${network.chainName}, with a 90 minute expiry.`;

      // On research agent failure: rethrow untouched — never fabricate a plan.
      const { plan, rawStdout, agentName = "Research Agent" } = await deps.runResearchAgent({
        taskId: task.id,
        question: task.userQuestion,
        budgetAmount,
        providerCatalog,
        policySummary
      });

      const recommendedProfile = profiles.find(
        (profile) => profile.id === plan.recommendedProviderId
      );

      // Ranked shortlist the user picks from. validateResearchPlanOutput
      // normalizes plan.ranking (populated, recommended-first); fall back to a
      // single-entry list if a raw/unvalidated output omitted it.
      const ranking = plan.ranking ?? [
        { providerId: plan.recommendedProviderId, reason: plan.reason }
      ];
      const candidates = ranking.map((entry, index) => ({
        providerId: entry.providerId as ProviderId,
        reason: entry.reason,
        rank: index + 1
      }));

      const procurementPlan: ProcurementPlan = {
        taskId: task.id,
        userQuestion: task.userQuestion,
        evidenceNeed: plan.reason,
        totalBudget: `${plan.maxPayment} ${assetSymbol}`,
        perJobCap: `${plan.maxPayment} ${assetSymbol}`,
        recommendedProviderId: plan.recommendedProviderId as ProviderId,
        providerCount: 3,
        coverage:
          recommendedProfile?.coverage ??
          (locale === "zh" ? "专项资料覆盖" : "specialized evidence coverage"),
        returnType: "provider-answer-package",
        verificationMethod:
          locale === "zh"
            ? "确定性 Judge 校验端点"
            : "Deterministic Judge verification endpoint",
        providerReputations,
        candidates
      };

      const planned = transition(
        {
          ...task,
          plan: procurementPlan,
          claudePlanRaw: rawStdout,
          selectedProviderIds: profiles.map((profile) => profile.id)
        },
        "Planned"
      );

      let result = save(
        withAudit(
          planned,
          audit({
            taskId: id,
            source: "research-agent",
            type: "procurement_plan_created",
            result: "success",
            message:
              locale === "zh"
                ? `${agentName} 推荐 ${plan.recommendedProviderId}（最高支付 ${plan.maxPayment} ${assetSymbol}）：${plan.reason}`
                : `${agentName} recommended ${plan.recommendedProviderId} (max payment ${plan.maxPayment} ${assetSymbol}): ${plan.reason}`
          })
        )
      );

      const onchainScores = providerReputations.filter((r) => r.source === "erc8004");
      if (onchainScores.length > 0) {
        result = save(
          withAudit(
            result,
            audit({
              taskId: id,
              source: "chain",
              type: "reputation_loaded",
              result: "success",
              message:
                locale === "zh"
                  ? "已从 ERC-8004 信誉注册表读取链上信誉分：" +
                    onchainScores.map((r) => `${r.providerId}=${r.score}`).join("，") +
                    "。"
                  : "Loaded on-chain reputation from the ERC-8004 registry: " +
                    onchainScores.map((r) => `${r.providerId}=${r.score}`).join(", ") +
                    "."
            })
          )
        );
      }
      if (reputationFallbacks.length > 0) {
        result = save(
          withAudit(
            result,
            audit({
              taskId: id,
              source: "chain",
              type: "reputation_read_fallback",
              result: "failed",
              message:
                locale === "zh"
                  ? "链上信誉读取失败，以下 Provider 已回退本地预设分（非致命）：" +
                    reputationFallbacks.join("；")
                  : "On-chain reputation read failed; these Providers fell back to local preset scores (non-fatal): " +
                    reputationFallbacks.join("; ")
            })
          )
        );
      }
      return result;
    },

    async submitPolicy(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      assertStatus(task, ["Planned"], "submit policy");
      const budgetAmount = leadingDecimal(task.budgetLimit);
      const challengeManagerAddress = deps.deployment.contracts.ProofMarketChallengeManager;
      const submission = buildRealPolicySubmission({
        escrowAddress,
        tokenAddress,
        challengeManagerAddress,
        budgetAmount,
        taskId: task.id,
        network: {
          policyChainId: network.policyChainId,
          label: network.chainName,
          assetSymbol
        }
      });

      const result = await deps.policySigner.submitPolicy(submission);
      const policy: PolicySummary = {
        intent: submission.intent,
        totalBudget: `${budgetAmount} ${assetSymbol}`,
        perJobCap: `${budgetAmount} ${assetSymbol}`,
        allowedTargets: [
          escrowAddress,
          tokenAddress,
          ...(challengeManagerAddress ? [challengeManagerAddress] : [])
        ],
        allowedFunctions: [
          "approve",
          "createJob",
          "setBudget",
          "fund",
          "complete",
          "openChallenge"
        ],
        denyRules: [
          locale === "zh" ? "默认禁止任何直接转账（无转账策略）" : "Direct transfers are denied by default",
          locale === "zh" ? "最多 10 笔交易" : "At most 10 transactions",
          locale === "zh" ? "90 分钟后自动过期" : "Automatically expires after 90 minutes"
        ],
        expiresInMinutes: 90,
        policyId: result.policyId,
        // Even if PolicySigner auto-approves immediately, stay in PolicySubmitted here;
        // activatePolicy is the explicit activation gate. Strict equality so
        // "inactive"/"deactivated" never read as active.
        status: result.status.trim().toLowerCase() === "active" ? "active" : "submitted"
      };

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
                ? `已提交受限签名策略 ${policy.policyId}，状态 ${result.status}。`
                : `Submitted Policy Signer policy ${policy.policyId}; status ${result.status}.`,
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

      const status = await deps.policySigner.getPolicyStatus(task.policy.policyId);
      // Strict equality: "inactive"/"deactivated" must NOT count as active.
      const isActive = status.status.trim().toLowerCase() === "active";
      if (!isActive) {
        return save(
          withAudit(
            task,
            audit({
              taskId: id,
              source: "policy-signer",
              type: "policy_activation_pending",
              result: "pending",
              message:
                locale === "zh"
                  ? `受限签名策略 ${task.policy.policyId} 尚未激活（状态 ${status.status}）。原始返回：${truncate(status.raw)}`
                  : `Policy Signer policy ${task.policy.policyId} is not active yet (status ${status.status}). Raw response: ${truncate(status.raw)}`,
              policyId: task.policy.policyId
            })
          )
        );
      }

      const activated = transition(
        {
          ...task,
          policy: { ...task.policy, status: "active" }
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
                ? `受限签名策略 ${task.policy.policyId} 已激活。`
                : `Policy Signer policy ${task.policy.policyId} is active.`,
            policyId: task.policy.policyId
          })
        )
      );
    },

    async executeEscrow(id: string, providerId?: ProviderId): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      // Both pre-states are legal per the state machine (DeniedByPolicy -> JobFunded).
      assertStatus(task, ["PolicyActive", "DeniedByPolicy"], "execute escrow");
      if (inFlight.has(id)) {
        throw new Error("operation already in progress for this task");
      }
      inFlight.add(id);
      try {
        if (task.policy?.status !== "active") {
          throw new Error("policy not active — approve it first");
        }
        if (!task.plan) {
          throw new Error("Cannot execute escrow without a procurement plan");
        }
        const jobProvider = resolveJobProvider(task, providerId);

        // Fund what the plan says: perJobCap carries the Claude-validated
        // maxPayment, already checked against budgetLimit (the user ceiling)
        // when the plan was produced.
        const budgetAmount = leadingDecimal(task.plan.perJobCap);
        const budgetRaw = BigInt(Math.round(Number(budgetAmount) * 1e6));
        const taskRef = { task };

        await assertProviderStakeAvailable(taskRef, jobProvider);

        await policySignerCall(
          taskRef,
          "approve",
          tokenAddress,
          encodeApprove(escrowAddress, budgetRaw)
        );

        const unixNow = Math.floor(Date.parse(deps.now()) / 1000);
        const createJobReceipt = await policySignerCall(
          taskRef,
          "createJob",
          escrowAddress,
          encodeCreateJob({
            providerAgentId: jobProvider.agentId,
            provider: jobProvider.address,
            verifierAgentId: 3n,
            evaluator: deps.deployment.policySignerAddress as `0x${string}`,
            token: tokenAddress,
            expiredAt: BigInt(unixNow + 7200),
            descriptionHash: stableHash({
              taskId: task.id,
              question: task.userQuestion
            }) as `0x${string}`,
            coverageHash: stableHash({ coverage: task.plan.coverage }) as `0x${string}`
          })
        );

        const jobId = deps.chain.extractJobId(createJobReceipt, escrowAddress);
        taskRef.task = save({
          ...taskRef.task,
          selectedProviderId: jobProvider.providerId,
          jobId: Number(jobId),
          updatedAt: deps.now()
        });

        await policySignerCall(taskRef, "setBudget", escrowAddress, encodeSetBudget(jobId, budgetRaw));
        await policySignerCall(taskRef, "fund", escrowAddress, encodeFund(jobId, budgetRaw));

        // Post-fund readback: the chain is the source of truth, not the
        // sequence of confirmed receipts. State 1 = Funded. Public RPC
        // endpoints sometimes serve a lagging replica right after a tx
        // confirms (or hiccup outright), so poll a few times before declaring
        // a mismatch — a stale read must not strand a correctly funded job.
        let jobState: { state: number; budget: bigint } | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            jobState = await deps.chain.readJobState(escrowAddress, jobId);
            if (jobState.state === 1 && jobState.budget === budgetRaw) break;
          } catch {
            jobState = null;
          }
          if (attempt < 4) await delay(pollDelayMs);
        }
        if (!jobState || jobState.state !== 1 || jobState.budget !== budgetRaw) {
          throw new Error(
            `post-fund readback mismatch for job ${jobId}: ` +
              `state=${jobState?.state} (expected 1 Funded), ` +
              `budget=${jobState?.budget} (expected ${budgetRaw})`
          );
        }
        taskRef.task = save(
          withAudit(
            taskRef.task,
            audit({
              taskId: id,
              source: "chain",
              type: "escrow_funded_verified",
              result: "success",
              message:
                locale === "zh"
                  ? `链上回读确认订单 ${jobId} 已注资（Funded），预算 ${jobState.budget} 原始单位。`
                  : `On-chain readback confirmed job ${jobId} is funded with budget ${jobState.budget} raw units.`,
              policyId: task.policy.policyId,
              jobId: Number(jobId)
            })
          )
        );

        const funded = transition(taskRef.task, "JobFunded");

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
                  ? `托管订单 ${jobId} 已在 ${network.chainName} 上为 Provider ${jobProvider.providerId} 注资 ${budgetAmount} ${assetSymbol}。`
                  : `Escrow job ${jobId} was funded for Provider ${jobProvider.providerId} with ${budgetAmount} ${assetSymbol} on ${network.chainName}.`,
              policyId: task.policy.policyId,
              jobId: Number(jobId)
            })
          )
        );
      } finally {
        inFlight.delete(id);
      }
    },

    async triggerDenial(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      // Gate before the policy signer side effect: a denial attempt against an
      // unapproved policy would prove nothing about the policy.
      assertStatus(task, ["PolicyActive"], "trigger denial");
      if (!task.policy) {
        throw new Error("Cannot trigger a denial demo without a policy");
      }

      const denial = await deps.policySigner.attemptDeniedTransfer({
        policyId: task.policy.policyId,
        dstAddress: "0x000000000000000000000000000000000000dEaD",
        amount: "0.001"
      });

      const denied = transition(
        {
          ...task,
          denial
        },
        "DeniedByPolicy"
      );

      return save(
        withAudit(
          denied,
          audit({
            taskId: id,
            source: "policy-signer",
            type: "escrow_denied",
            result: "denied",
            // rawOutput is the signer refusal detail; keep it intact as evidence.
            message:
              locale === "zh"
                ? `策略签名器已拒绝 ${denial.attemptedAction}（退出码 ${denial.exitCode}）。原始输出：${truncate(denial.rawOutput)}`
                : `Policy Signer rejected ${denial.attemptedAction} (exit ${denial.exitCode}). Raw output: ${truncate(denial.rawOutput)}`,
            policyId: task.policy.policyId
          })
        )
      );
    },

    async runProvider(id: string, providerId: ProviderId): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      assertStatus(task, ["JobFunded"], "run provider");
      if (task.jobId === null) {
        throw new Error("Cannot run provider before the job is funded");
      }
      const selectedProviderId = task.selectedProviderId ?? task.plan?.recommendedProviderId ?? null;
      if (selectedProviderId && providerId !== selectedProviderId) {
        throw new Error(
          `Provider mismatch: job was funded for ${selectedProviderId}, cannot run ${providerId}`
        );
      }
      const jobId = String(task.jobId);

      const providerPackage = await deps.services.runProvider({
        taskId: task.id,
        jobId,
        providerId,
        question: task.userQuestion,
        locale
      });

      let current = save(
        withAudit(
          { ...task, providerPackage, updatedAt: deps.now() },
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

      const submitted = await deps.services.submitDeliverable({
        providerId,
        jobId,
        deliverableHash: providerPackage.packageHash
      });
      const submitRecord: TxRecord = {
        label: "submit",
        policySignerRequestId: null,
        txHash: submitted.txHash,
        status: "confirmed"
      };
      current = save(
        withAudit(
          {
            ...current,
            txRecords: [...current.txRecords, submitRecord],
            updatedAt: deps.now()
          },
          audit({
            taskId: id,
            source: "chain",
            type: "deliverable_submitted",
            result: "success",
            message:
              locale === "zh"
                ? `Provider 已将证据服务包哈希 ${providerPackage.packageHash} 提交上链。`
                : `Provider submitted package hash ${providerPackage.packageHash} on-chain.`,
            txHash: submitted.txHash,
            jobId: task.jobId
          })
        )
      );

      // Integrity check: never trust the service response alone — the chain is
      // the source of truth. Poll a few times: a lagging RPC replica right
      // after the submit confirmation must not fail a correct delivery.
      let deliverableOnChain = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const jobState = await deps.chain.readJobState(escrowAddress, BigInt(task.jobId));
          deliverableOnChain = jobState.deliverableHash;
          if (deliverableOnChain.toLowerCase() === providerPackage.packageHash.toLowerCase()) break;
        } catch {
          deliverableOnChain = "";
        }
        if (attempt < 4) await delay(pollDelayMs);
      }
      if (deliverableOnChain.toLowerCase() !== providerPackage.packageHash.toLowerCase()) {
        throw new Error(
          `on-chain deliverable hash mismatch: chain has ${deliverableOnChain}, ` +
            `provider package is ${providerPackage.packageHash}`
        );
      }

      // Challenge window W_c starts at submit: the client may still accept the
      // work immediately, while separate evaluators must wait for the window.
      if (challengeWindowMs > 0) {
        const endsAt = new Date(Date.parse(deps.now()) + challengeWindowMs).toISOString();
        current = save(
          withAudit(
            { ...current, challengeWindowEndsAt: endsAt, updatedAt: deps.now() },
            audit({
              taskId: id,
              source: "chain",
              type: "challenge_window_opened",
              result: "success",
              message:
                locale === "zh"
                  ? `挑战窗口开启：${Math.round(challengeWindowMs / 60000)} 分钟内可对证据服务包发起挑战，买方也可以直接验收结算，结算交易即表示不发起挑战。`
                  : `Challenge window opened: the package can be challenged for ${Math.round(challengeWindowMs / 60000)} minutes. The buyer can also accept and settle immediately; the settlement transaction is the no-challenge signal.`,
              jobId: task.jobId
            })
          )
        );
      }

      return save(transition(current, "Delivered"));
    },

    async verify(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      assertStatus(task, ["Delivered"], "verify");
      if (!task.providerPackage) {
        throw new Error("Cannot verify before provider delivery");
      }

      const verdict = await deps.services.judgeVerify({
        taskId: task.id,
        jobId: String(task.jobId),
        evidencePackageHash: task.providerPackage.packageHash,
        evidencePackage: task.providerPackage,
        successCriteria: [
          "at least 3 evidence items",
          "every item has a source locator",
          "answer explains evidence relevance"
        ],
        locale
      });

      verdicts.set(task.id, verdict.verdictHash);
      const nextStatus: TaskStatus = verdict.decision === "valid" ? "Verified" : "Challenged";
      const verified = transition(task, nextStatus);

      return save(
        withAudit(
          verified,
          audit({
            taskId: id,
            source: "verifier",
            type: verdict.decision === "valid" ? "verification_passed" : "verification_failed",
            result: verdict.decision === "valid" ? "success" : "failed",
            // 步骤 5/6 用 verdictHash= 前缀正则提取哈希，保持该字段格式不变。
            message:
              locale === "zh"
                ? `Judge ${verdict.judgeId} 判定 ${verdict.decision}（${verdict.reasonCode}）verdictHash=${verdict.verdictHash}`
                : `Judge ${verdict.judgeId} returned ${verdict.decision} (${verdict.reasonCode}) verdictHash=${verdict.verdictHash}`,
            jobId: task.jobId
          })
        )
      );
    },

    async settle(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      assertStatus(task, ["Verified"], "settle");
      if (inFlight.has(id)) {
        throw new Error("operation already in progress for this task");
      }
      inFlight.add(id);
      try {
        if (task.jobId === null) {
          throw new Error("Cannot settle before verification");
        }
        // In the live demo the PolicySigner wallet is both client and evaluator. If the
        // client sends complete() before W_c expires, that transaction is the
        // explicit "I will not challenge" acceptance signal; separate evaluators
        // still have to wait for the on-chain window to close.
        const verdictHash = verdicts.get(task.id);
        if (!verdictHash) {
          throw new Error("No judge verdict hash recorded for this task");
        }

        const taskRef = { task };
        await policySignerCall(
          taskRef,
          "complete",
          escrowAddress,
          encodeComplete(BigInt(task.jobId), verdictHash as `0x${string}`)
        );

        const settled = transition(taskRef.task, "Settled");

        // Reputation feedback is NOT auto-published here: the user rates the
        // service explicitly on the completion page (rate() below), which is
        // what publishes the on-chain feedback.
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
                  ? `已向 Provider 结算付款，verdict 哈希 ${verdictHash}。`
                  : `Payment was settled to the Provider with verdict hash ${verdictHash}.`,
              jobId: task.jobId
            })
          )
        );
      } finally {
        inFlight.delete(id);
      }
    },

    async rate(id: string, score: number): Promise<Task> {
      const task = store.getTask(id);
      assertStatus(task, ["Settled", "Audited"], "rate");
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error("score must be an integer in 1-5");
      }
      if (task.txRecords.some((r) => r.label === "feedback")) {
        throw new Error("This task has already been rated");
      }
      // Map 1-5 stars onto the ERC-8004 feedback value scale (5★ = the former
      // FEEDBACK_POSITIVE_VALUE, so reputation reads stay on the same scale).
      const value = score * (FEEDBACK_POSITIVE_VALUE / 5);
      return publishReputationFeedback(task, {
        value,
        tag2: "job.completed",
        sentiment: score >= 3 ? (normalizeLocale(task.locale) === "zh" ? "好评" : "positive") : (normalizeLocale(task.locale) === "zh" ? "差评" : "negative")
      });
    },

    // ── Deterministic challenge flow (P2-c): real protocol + funds, preset
    //    content & vote. openChallenge/resolve move real money on Sepolia. ──

    async openChallenge(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      // Delivered-only by design: the user challenge targets the freshly
      // delivered package (spec 08 step 1); after Verified the demo settles.
      assertStatus(task, ["Delivered"], "open challenge");
      if (inFlight.has(id)) {
        throw new Error("operation already in progress for this task");
      }
      inFlight.add(id);
      try {
        const challengeManagerAddress = deps.deployment.contracts.ProofMarketChallengeManager;
        if (!challengeManagerAddress) {
          throw new Error(
            "deployment artifact has no contracts.ProofMarketChallengeManager — " +
              "redeploy with the P0-2 script before running the challenge path"
          );
        }
        const depositRaw = deps.deployment.challengeManagerParams?.challengeDeposit;
        if (!depositRaw) {
          throw new Error(
            "deployment artifact has no challengeManagerParams.challengeDeposit — " +
              "cannot size the challenge deposit approval"
          );
        }
        // Jury fee F is collected together with the deposit at openChallenge.
        const juryFeeRaw = deps.deployment.challengeManagerParams?.juryFee ?? "0";
        const approveAmount = BigInt(depositRaw) + BigInt(juryFeeRaw);
        if (task.jobId === null) {
          throw new Error("Cannot open a challenge before the job is funded");
        }

        // Preset counter-evidence: only its hash goes on-chain (spec 08 step 2).
        const presetCounterEvidence = getPresetCounterEvidence(locale);
        const presetChallengeDocument = getPresetChallengeDocument(locale);
        const counterEvidenceHash = stableHash(presetCounterEvidence) as `0x${string}`;
        const opened = save(
          withAudit(
            {
              ...task,
              challenge: {
                type: "CoverageMiss" as const,
                statement: presetChallengeDocument.statement,
                hitCoverageClause: presetChallengeDocument.hitCoverageClause,
                counterEvidenceHash
              },
              updatedAt: deps.now()
            },
            audit({
              taskId: id,
              source: "user",
              type: "challenge_opened",
              result: "success",
              message:
                locale === "zh"
                  ? `用户发起挑战：类型 CoverageMiss，反证哈希 ${counterEvidenceHash}。挑战者为 PolicySigner 钱包（订单 client），将锁定挑战押金 ${formatPayment(BigInt(depositRaw))} + 陪审费 ${formatPayment(BigInt(juryFeeRaw))} 并冻结托管订单。陪审方指派：${presetChallengeDocument.juryAssignmentBasis}`
                  : `User opened a CoverageMiss challenge with counter-evidence hash ${counterEvidenceHash}. The challenger is the Policy Signer wallet (the job client), locking challenge deposit ${formatPayment(BigInt(depositRaw))} plus jury fee ${formatPayment(BigInt(juryFeeRaw))} and freezing the escrow order. Jury assignment: ${presetChallengeDocument.juryAssignmentBasis}`,
              jobId: task.jobId
            })
          )
        );

        // Both calls are PolicySigner-routed (Policy-bounded): the PolicySigner wallet is the job
        // client, satisfying the contract's challenger ∈ {client, evaluator}.
        const taskRef = { task: opened };
        await policySignerCall(
          taskRef,
          "approveDeposit",
          tokenAddress,
          encodeApprove(challengeManagerAddress as `0x${string}`, approveAmount)
        );
        // One call: the contract's openChallenge locks deposit + jury fee AND
        // calls escrow.markChallenged itself, freezing the job.
        const receipt = await policySignerCall(
          taskRef,
          "openChallenge",
          challengeManagerAddress,
          encodeOpenChallenge(BigInt(task.jobId), ChallengeType.CoverageMiss, counterEvidenceHash)
        );
        challengeOpenedAt.set(id, Date.parse(deps.now()));

        // challengeId comes from the ChallengeOpened event — needed by resolve().
        const challengeId = deps.chain.extractChallengeId(receipt, challengeManagerAddress);
        taskRef.task = save({
          ...taskRef.task,
          challenge: { ...taskRef.task.challenge!, challengeId: Number(challengeId) },
          updatedAt: deps.now()
        });

        const challenged = save(
          withAudit(
            transition(taskRef.task, "Challenged"),
            audit({
              taskId: id,
              source: "chain",
              type: "challenge_onchain_opened",
              result: "success",
              message:
                locale === "zh"
                  ? `挑战已上链：ChallengeManager 已锁定押金与陪审费并冻结订单 ${task.jobId}（challengeId ${challengeId}）。Provider 应辩窗口开启。`
                  : `Challenge is on-chain: ChallengeManager locked deposit and jury fee, froze job ${task.jobId}, and opened the Provider defense window (challengeId ${challengeId}).`,
              jobId: task.jobId
            })
          )
        );

        // Provider defense (应辩书): preset content, real provider-signed tx.
        // Non-fatal on failure — skipping the defense forfeits it (合约语义),
        // the jury still waits out R_w before voting.
        try {
          const challengedProviderId =
            challenged.providerPackage?.providerId ??
            challenged.selectedProviderId ??
            challenged.plan?.recommendedProviderId;
          if (!challengedProviderId) {
            throw new Error("Cannot submit provider defense without a selected Provider");
          }
          const defense = await deps.services.providerDefend({
            providerId: challengedProviderId,
            challengeId: String(challengeId),
            locale
          });
          const defenseRecord: TxRecord = {
            label: "defense",
            policySignerRequestId: null,
            txHash: defense.txHash,
            status: "confirmed"
          };
          return save(
            withAudit(
              {
                ...challenged,
                challenge: {
                  ...challenged.challenge!,
                  defense: {
                    statement: defense.statement,
                    defenseHash: defense.defenseHash,
                    txHash: defense.txHash
                  }
                },
                txRecords: [...challenged.txRecords, defenseRecord],
                updatedAt: deps.now()
              },
              audit({
                taskId: id,
                source: "provider",
                type: "defense_submitted",
                result: "success",
                message:
                  locale === "zh"
                    ? `Provider 已在应辩窗口内提交应辩书（哈希 ${defense.defenseHash}）：${defense.statement}`
                    : `Provider submitted a Defense Statement within the defense window (hash ${defense.defenseHash}): ${defense.statement}`,
                txHash: defense.txHash,
                jobId: task.jobId
              })
            )
          );
        } catch (error) {
          return save(
            withAudit(
              challenged,
              audit({
                taskId: id,
                source: "provider",
                type: "defense_skipped",
                result: "failed",
                message:
                  locale === "zh"
                    ? `Provider 应辩提交失败（视同放弃应辩，裁决照常进行）：${error instanceof Error ? error.message : String(error)}`
                    : `Provider defense submission failed; this is treated as waived defense and the verdict proceeds: ${error instanceof Error ? error.message : String(error)}`,
                jobId: task.jobId
              })
            )
          );
        }
      } finally {
        inFlight.delete(id);
      }
    },

    async winChallenge(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      assertStatus(task, ["Challenged"], "win challenge");
      if (inFlight.has(id)) {
        throw new Error("operation already in progress for this task");
      }
      inFlight.add(id);
      try {
      if (!task.challenge || task.challenge.challengeId == null) {
        throw new Error(
          "no on-chain challenge recorded for this task — open the challenge first"
        );
      }

      // The jury panel (陪审团确定性裁决): three real castVote transactions,
      // preset 2:1 ProviderFault. The contract rejects votes before
      // openedAt + R_w, so wait the window out HERE (a long sleep inside the
      // services HTTP call would trip undici's headers timeout instead).
      const openedAtMs = challengeOpenedAt.get(id) ?? Date.parse(task.updatedAt);
      const defenseWindowMs =
        Number(deps.deployment.challengeManagerParams?.defenseWindow ?? 0) * 1000;
      if (defenseWindowMs > 0) {
        const remainingWindowMs =
          openedAtMs + defenseWindowMs + 5_000 - Date.parse(deps.now());
        if (remainingWindowMs > 0) {
          await delay(remainingWindowMs);
        }
      }
      const { votes } = await deps.services.juryVote({
        challengeId: String(task.challenge.challengeId),
        openedAtMs,
        locale
      });
      const faultVotes = votes.filter((vote) => vote.vote === "ProviderFault").length;
      const majority = Math.floor(votes.length / 2) + 1;
      if (faultVotes < majority) {
        throw new Error(
          `unexpected jury outcome: ${faultVotes}/${votes.length} ProviderFault votes (need ${majority})`
        );
      }

      let current: Task = { ...task, challenge: { ...task.challenge, votes } };
      const voteRecords: TxRecord[] = votes.map((vote) => ({
        label: "castVote" as const,
        policySignerRequestId: null,
        txHash: vote.txHash ?? "",
        status: "confirmed" as const
      }));
      current = { ...current, txRecords: [...current.txRecords, ...voteRecords] };
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
                ? `陪审方 ${vote.jurorAddress.slice(0, 10)}… 投票 ${vote.vote}（${vote.reasonCode}），理由书哈希 ${vote.reasonHash} 已随票上链。结论：${vote.reasonBook.conclusion}`
                : `Juror ${vote.jurorAddress.slice(0, 10)}... voted ${vote.vote} (${vote.reasonCode}); reason-book hash ${vote.reasonHash} was committed with the vote. Conclusion: ${vote.reasonBook.conclusion}`,
            txHash: vote.txHash ?? null,
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
                ? `陪审团多数决 ${faultVotes}:${votes.length - faultVotes} 判 ProviderFault，挑战成立。多数已达成，任何人可执行链上裁决。`
                : `Jury majority ${faultVotes}:${votes.length - faultVotes} found ProviderFault and upheld the challenge. Majority is final; anyone can execute the on-chain verdict.`,
            jobId: task.jobId
          })
        )
      );
      } finally {
        inFlight.delete(id);
      }
    },

    async refundOrSlash(id: string): Promise<Task> {
      const task = store.getTask(id);
      const locale = normalizeLocale(task.locale);
      assertStatus(task, ["ChallengeWon"], "refund or slash");
      if (inFlight.has(id)) {
        throw new Error("operation already in progress for this task");
      }
      inFlight.add(id);
      try {
        const challenge = task.challenge;
        if (!challenge || challenge.challengeId == null) {
          throw new Error("no on-chain challenge recorded for this task");
        }

        // resolve(challengeId) executes the on-chain vote majority — it is
        // permissionless, signed here by the backend's resolver key (not
        // PolicySigner). On-chain it slashes the provider stake, pays the challenger
        // (deposit + fee refund + reward), pays the jury fee out of the slash,
        // sends the remainder to the treasury and refunds the buyer.
        let resolved: { txHash: string };
        try {
          resolved = await deps.resolveChallenge({
            challengeId: BigInt(challenge.challengeId)
          });
        } catch (error) {
          // No fabrication: surface the failure with a failed record + audit.
          const failedRecord: TxRecord = {
            label: "resolve",
            policySignerRequestId: null,
            txHash: "",
            status: "failed"
          };
          save(
            withAudit(
              { ...task, txRecords: [...task.txRecords, failedRecord], updatedAt: deps.now() },
              audit({
                taskId: id,
                source: "chain",
                type: "chain_tx_failed",
                result: "failed",
                message:
                  locale === "zh"
                    ? `resolve 执行失败：${error instanceof Error ? error.message : String(error)}`
                    : `resolve execution failed: ${error instanceof Error ? error.message : String(error)}`,
                jobId: task.jobId
              })
            )
          );
          throw error;
        }

        const resolveRecord: TxRecord = {
          label: "resolve",
          policySignerRequestId: null,
          txHash: resolved.txHash,
          status: "confirmed"
        };
        const updated = save({
          ...task,
          txRecords: [...task.txRecords, resolveRecord],
          challenge: { ...challenge, resolvedTxHash: resolved.txHash },
          updatedAt: deps.now()
        });

        const refunded = transition(updated, "RefundedOrSlashed");
        const refundedTask = save(
          withAudit(
            refunded,
            audit({
              taskId: id,
              source: "settlement",
              type: "refund_or_slash",
              result: "success",
              message:
                locale === "zh"
                  ? "链上裁决已执行：扣除 Provider 质押 50%（挑战者得一半作奖励），托管资金退款买方，挑战者押金与陪审费全额退回，陪审费由扣罚承担、三位陪审方均分，余额归入金库。"
                  : "On-chain verdict executed: 50% of the Provider bond was slashed, half of the slash rewards the challenger, escrowed funds return to the buyer, the challenge deposit and jury fee are fully returned, the jury fee is paid from the slash and split across three jurors, and the remainder goes to the treasury.",
              txHash: resolved.txHash,
              jobId: task.jobId
            })
          )
        );

        // Post-resolution: negative on-chain reputation feedback for the
        // at-fault provider (real tx, rater key, non-fatal on failure).
        return publishReputationFeedback(refundedTask, {
          value: FEEDBACK_NEGATIVE_VALUE,
          tag2: "challenge.coverage_miss",
          sentiment: locale === "zh" ? "差评" : "negative"
        });
      } finally {
        inFlight.delete(id);
      }
    }
  };
}
