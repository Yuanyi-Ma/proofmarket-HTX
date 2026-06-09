import {
  generateProcurementPlan,
  runProvider as runProviderAgent,
  verifyPackage
} from "@proofmarket/agents/src";
import { buildPactPolicy } from "@proofmarket/cobo/src";
import { createAuditEvent } from "@proofmarket/shared/src/audit";
import { providerProfiles } from "@proofmarket/shared/src/fixtures";
import { assertTransition } from "@proofmarket/shared/src/stateMachine";
import type {
  AuditEvent,
  AuditResult,
  AuditSource,
  PactSummary,
  ProviderId,
  Task,
  TaskStatus
} from "@proofmarket/shared/src/types";
import { appendAudit } from "./auditStore";
import type { InMemoryStore } from "./demoStore";

export type TaskService = {
  getTask(id: string): Task;
  listTasks(): Task[];
  createTask(question: string, budget: string): Task;
  plan(id: string): Task;
  submitPact(id: string): Task;
  activatePact(id: string): Task;
  executeEscrow(id: string): Task;
  triggerDenial(id: string): Task;
  runProvider(id: string, providerId: ProviderId): Task;
  verify(id: string): Task;
  settle(id: string): Task;
  winChallenge(id: string): Task;
  refundOrSlash(id: string): Task;
};

export function createTaskService(store: InMemoryStore): TaskService {
  let taskCounter = 0;
  let auditCounter = 0;

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
    pactId?: string | null;
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

  function pactFor(task: Task): PactSummary {
    const policy = buildPactPolicy({
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
      pactId: `pact_${task.id.slice("task_".length)}`,
      status: "submitted"
    };
  }

  return {
    getTask(id: string): Task {
      return store.getTask(id);
    },

    listTasks(): Task[] {
      return store.listTasks();
    },

    createTask(question: string, budget: string): Task {
      const timestamp = now();
      const id = nextTaskId();
      const task: Task = {
        id,
        userQuestion: question,
        status: "Created",
        budgetLimit: budget,
        selectedProviderIds: [],
        plan: null,
        pact: null,
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
            message: `User created task with budget ${budget}.`
          })
        )
      );
    },

    plan(id: string): Task {
      const task = store.getTask(id);
      const plan = generateProcurementPlan(
        task.id,
        task.userQuestion
      );
      const selectedProviderIds = providerProfiles.map((provider) => provider.id);
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
            message: `Selected ${selectedProviderIds.join(", ")}.`
          })
        )
      );
    },

    submitPact(id: string): Task {
      const task = store.getTask(id);
      const pact = pactFor(task);
      const submitted = transition(
        {
          ...task,
          pact
        },
        "PactSubmitted"
      );

      return save(
        withAudit(
          submitted,
          audit({
            taskId: id,
            source: "cobo",
            type: "pact_submitted",
            result: "success",
            message: `Submitted pact ${pact.pactId}.`,
            pactId: pact.pactId
          })
        )
      );
    },

    activatePact(id: string): Task {
      const task = store.getTask(id);
      if (!task.pact) {
        throw new Error("Cannot activate pact before submission");
      }
      const pact: PactSummary = {
        ...task.pact,
        status: "active"
      };
      const activated = transition(
        {
          ...task,
          pact
        },
        "PactActive"
      );

      return save(
        withAudit(
          activated,
          audit({
            taskId: id,
            source: "cobo",
            type: "pact_activated",
            result: "success",
            message: `Activated pact ${pact.pactId}.`,
            pactId: pact.pactId
          })
        )
      );
    },

    executeEscrow(id: string): Task {
      const task = store.getTask(id);
      const funded = transition(
        {
          ...task,
          jobId: 1
        },
        "JobFunded"
      );

      return save(
        withAudit(
          funded,
          audit({
            taskId: id,
            source: "cobo",
            type: "escrow_executed",
            result: "success",
            message: "Escrow job funded on demo chain.",
            txHash: "0xproofmarket0000000000000000000000000000000000000000000000000001",
            pactId: task.pact?.pactId ?? null,
            jobId: 1
          })
        )
      );
    },

    triggerDenial(id: string): Task {
      const task = store.getTask(id);
      const denied = transition(task, "DeniedByCobo");
      const denial = {
        denied: true,
        reason:
          "Direct transfer rejected because target is not whitelisted and amount exceeds Pact cap.",
        attemptedTarget: "0xDeniedDirectTransfer",
        attemptedFunction: "transfer",
        attemptedAmount: "10 SETH",
        movedFunds: "0 test USDC"
      };

      return save(
        withAudit(
          denied,
          audit({
            taskId: id,
            source: "cobo",
            type: "escrow_denied",
            result: "denied",
            message:
              `${denial.reason} Attempted target=${denial.attemptedTarget}; ` +
              `function=${denial.attemptedFunction}; amount=${denial.attemptedAmount}; ` +
              `moved funds=${denial.movedFunds}; no escrow job created.`,
            pactId: task.pact?.pactId ?? null
          })
        )
      );
    },

    runProvider(id: string, providerId: ProviderId): Task {
      const task = store.getTask(id);
      const providerPackage = runProviderAgent(task.id, providerId);
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
            message: `Provider ${providerId} delivered package ${providerPackage.packageHash}.`,
            jobId: task.jobId
          })
        )
      );
    },

    verify(id: string): Task {
      const task = store.getTask(id);
      if (!task.providerPackage || task.status !== "Delivered") {
        throw new Error("Cannot verify before provider delivery");
      }

      const verdict = verifyPackage(task.providerPackage);
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

    settle(id: string): Task {
      const task = store.getTask(id);
      const settled = transition(task, "Settled");

      return save(
        withAudit(
          settled,
          audit({
            taskId: id,
            source: "settlement",
            type: "settled",
            result: "success",
            message: "Provider payment settled.",
            jobId: task.jobId
          })
        )
      );
    },

    winChallenge(id: string): Task {
      const task = store.getTask(id);
      const won = transition(task, "ChallengeWon");

      return save(
        withAudit(
          won,
          audit({
            taskId: id,
            source: "verifier",
            type: "challenge_won",
            result: "success",
            message: "Challenge won after provider fault verdict.",
            jobId: task.jobId
          })
        )
      );
    },

    refundOrSlash(id: string): Task {
      const task = store.getTask(id);
      const refunded = transition(task, "RefundedOrSlashed");

      return save(
        withAudit(
          refunded,
          audit({
            taskId: id,
            source: "settlement",
            type: "refund_or_slash",
            result: "success",
            message: "Refund or provider slash executed.",
            jobId: task.jobId
          })
        )
      );
    }
  };
}
