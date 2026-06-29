import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "../app/page";
import { AuditLog } from "../components/AuditLog";
import { ChallengePanel } from "../components/ChallengePanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { ExecutionTimeline } from "../components/ExecutionTimeline";
import { FinalAnswer } from "../components/FinalAnswer";
import { ModeBadge } from "../components/ModeBadge";
import { PolicyReview } from "../components/PolicyReview";
import { ProviderMarket } from "../components/ProviderMarket";
import { TaskEntry } from "../components/TaskEntry";
import type {
  AuditEvent,
  PolicySummary,
  ProviderAnswerPackage,
  Task
} from "@proofmarket/shared/src/types";

const providerPackage: ProviderAnswerPackage = {
  taskId: "task_001",
  providerAgentId: 1,
  providerId: "execution-research-expert",
  providerName: "Execution Research Expert Agent",
  coverageStatement:
    "Searched 2021-2026 blockchain transaction execution acceleration sources.",
  packageHash: "0xpackagehash",
  answers: [
    {
      providerAnswer: "Parallel execution and conflict detection matter.",
      sourceTitle: "Block-STM",
      sourceLocator: "arXiv:2203.06871",
      sourceLibrary: "arxiv",
      sourceMetadata: { year: 2022, type: "paper" },
      excerptOrSummary: "Block-STM executes ordered transactions concurrently.",
      relevanceExplanation: "Directly supports execution acceleration."
    }
  ]
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "Created",
    budgetLimit: "5 USDC",
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "audit_001",
    taskId: "task_001",
    source: "chain",
    type: "chain_tx_confirmed",
    result: "success",
    message: "approve confirmed on Injective.",
    txHash: null,
    policyId: null,
    jobId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function realPolicy(overrides: Partial<PolicySummary> = {}): PolicySummary {
  return {
    intent: "Fund one provider research job.",
    totalBudget: "5 USDC",
    perJobCap: "5 USDC",
    allowedTargets: ["ProofMarketEscrow", "Injective USDC"],
    allowedFunctions: ["approve", "createJob", "setBudget", "fund", "complete"],
    denyRules: ["direct transfers denied by default", "max 7 txs"],
    expiresInMinutes: 90,
    policyId: "policy_real_001",
    status: "submitted",
    ...overrides
  };
}

const sampleTxHash = `0x${"ab12".repeat(16)}`;

function timelineRowClass(html: string, state: string): string {
  const pattern = new RegExp(
    `<div class="timeline-row ([^"]+)">(?:(?!<div class="timeline-row).)*<strong>${state}</strong>`,
    "s"
  );

  return pattern.exec(html)?.[1] ?? "";
}

describe("ProofMarket workflow UI content", () => {
  const noop = vi.fn();

  it("positions the public site as ProofMarket with Injective infrastructure", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain("Trusted Professional Evidence Network");
    expect(html).toContain("Injective Testnet");
    expect(html).toContain("escrowed payments");
    expect(html).not.toContain("Sepolia");
    expect(html).not.toContain("MockUSDC");
    expect(html).not.toContain("mUSDC");
    expect(html).not.toContain("sepolia.etherscan.io");
  });

  it("renders the task entry empty state and required create action", () => {
    const html = renderToStaticMarkup(
      <TaskEntry task={null} onCreate={noop} isBusy={false} />
    );

    expect(html).toContain("Submit a research question that needs evidence support");
    expect(html).toContain("Create Task");
  });

  it("renders exactly three provider candidates with recommended and shallow actions", () => {
    const html = renderToStaticMarkup(
      <ProviderMarket
        task={null}
        onRunExpert={noop}
        onRunShallow={noop}
      />
    );

    expect((html.match(/data-provider-card=/g) ?? [])).toHaveLength(3);
    expect(html).toContain("Blockchain Systems Evidence Agent");
    expect(html).toContain("Fast Literature Search Agent");
    expect(html).toContain("Consensus Layer Research Agent");
    expect(html).toContain("Run Recommended Provider");
    expect(html).toContain("Run Low-Reputation Provider");
  });

  it("renders policy signer boundaries and the CoverageMiss challenge path", () => {
    const policyHtml = renderToStaticMarkup(
      <PolicyReview task={null} onSubmit={noop} onFund={noop} onTriggerDenial={noop} />
    );
    const challengeHtml = renderToStaticMarkup(
      <ChallengePanel task={null} onWinChallenge={noop} onRefundOrSlash={noop} />
    );

    expect(policyHtml).toContain("5 USDC");
    expect(policyHtml).toContain("Allowed contracts");
    expect(policyHtml).toContain("Trigger Policy Signer Denial");
    expect(challengeHtml).toContain("CoverageMiss");
    expect(challengeHtml).toContain("Block-STM");
    expect(challengeHtml).toContain("Uphold Challenge");
    expect(challengeHtml).toContain("Refund or Slash");
  });

  it("keeps branch timeline states inactive when a happy path task is settled", () => {
    const html = renderToStaticMarkup(
      <ExecutionTimeline task={task({ status: "Settled" })} />
    );

    expect(html).toContain("Happy path");
    expect(html).toContain("Challenge branch");
    expect(html).toContain("Denial branch");
    expect(html).toContain("DeniedByPolicy");
    expect(html).toContain("Challenged");
    expect(html).toContain("not-taken");
    expect(timelineRowClass(html, "DeniedByPolicy")).toBe("not-taken");
    expect(timelineRowClass(html, "Challenged")).toBe("not-taken");
  });

  it("shows ReturnedToEscrowPath on the denial branch after restricted signer denial", () => {
    const html = renderToStaticMarkup(
      <ExecutionTimeline task={task({ status: "DeniedByPolicy" })} />
    );

    expect(html).toContain("ReturnedToEscrowPath");
    expect(html).toContain("escrow can be funded next");
  });

  it("renders the current backend signing policy without masking mismatches", () => {
    const html = renderToStaticMarkup(
      <PolicyReview
        task={task({
          status: "PolicyActive",
          policy: {
            intent: "Backend intent",
            totalBudget: "5 USDC",
            perJobCap: "1 USDC",
            allowedTargets: [
              "ProofMarketEscrow",
              "Injective USDC",
              "ProofMarketChallengeManager"
            ],
            allowedFunctions: [
              "createJob",
              "fund",
              "submit",
              "complete",
              "reject",
              "approve"
            ],
            denyRules: [
              "direct transfer",
              "non-whitelisted target",
              "amount above cap",
              "expired policy"
            ],
            expiresInMinutes: 30,
            policyId: "policy_001",
            status: "active"
          }
        })}
        onSubmit={noop}
        onFund={noop}
        onTriggerDenial={noop}
      />
    );

    expect(html).toContain("ProofMarketEscrow, Injective USDC, ProofMarketChallengeManager");
    expect(html).toContain("createJob, fund, submit, complete, reject, approve");
    expect(html).toContain("direct transfer");
    expect(html).toContain("non-whitelisted target");
    expect(html).toContain("amount above cap");
    expect(html).toContain("expired policy");
  });

  it("does not render the normal research conclusion before verification", () => {
    const html = renderToStaticMarkup(
      <FinalAnswer
        task={task({ status: "Delivered", providerPackage })}
        onSettle={noop}
        isBusy={false}
      />
    );

    expect(html).toContain("Waiting for evidence verification");
    expect(html).not.toContain("Recent blockchain execution acceleration work centers");
  });

  it("shows per-item verification status and package hash on evidence cards", () => {
    const html = renderToStaticMarkup(
      <EvidencePanel
        task={task({ status: "Verified", providerPackage })}
        onVerify={noop}
        isBusy={false}
      />
    );

    expect(html).toContain("Item verification status");
    expect(html).toContain("Verified");
    expect(html).toContain("Item package hash");
    expect(html).toContain("0xpackagehash");
  });

  it("allows a fresh task after one exists and disables creation while busy", () => {
    const existingTaskHtml = renderToStaticMarkup(
      <TaskEntry task={task()} onCreate={noop} isBusy={false} />
    );
    const busyHtml = renderToStaticMarkup(
      <TaskEntry task={null} onCreate={noop} isBusy />
    );

    expect(existingTaskHtml).toContain("Create New Task");
    expect(existingTaskHtml).not.toMatch(/<button disabled[^>]*>Create New Task/);
    expect(busyHtml).toMatch(/<button disabled[^>]*>Create Task/);
  });

  it("renders a mode badge for fixture and real tasks and none without a task", () => {
    const fixtureHtml = renderToStaticMarkup(<ModeBadge task={task()} />);
    const realHtml = renderToStaticMarkup(<ModeBadge task={task({ mode: "real" })} />);
    const emptyHtml = renderToStaticMarkup(<ModeBadge task={null} />);

    expect(fixtureHtml).toContain("Local simulation");
    expect(fixtureHtml).not.toContain("Sepolia");
    expect(realHtml).toContain("Injective Testnet");
    expect(emptyHtml).toBe("");
  });

  it("links audit events with a full tx hash to the Injective explorer", () => {
    const html = renderToStaticMarkup(
      <AuditLog
        task={task({
          audit: [
            auditEvent({ id: "audit_001", txHash: sampleTxHash }),
            auditEvent({ id: "audit_002", type: "task_created", txHash: null })
          ]
        })}
      />
    );

    expect(html).toContain(
      `href="https://testnet.blockscout.injective.network/tx/${sampleTxHash}"`
    );
    expect((html.match(/testnet\.blockscout\.injective\.network/g) ?? [])).toHaveLength(1);
    expect(html).not.toContain("sepolia.etherscan.io");
  });

  it("replaces challenge actions with a local-demo note in real mode", () => {
    const html = renderToStaticMarkup(
      <ChallengePanel
        task={task({ mode: "real", status: "Verified" })}
        onWinChallenge={noop}
        onRefundOrSlash={noop}
      />
    );

    expect(html).toContain("Local mechanism demo; unavailable in real mode");
    expect(html).not.toMatch(/<button[^>]*>Uphold Challenge<\/button>/);
    expect(html).not.toMatch(/<button[^>]*>Refund or Slash<\/button>/);
  });

  it("offers a policy activation check while a real policy is submitted", () => {
    const html = renderToStaticMarkup(
      <PolicyReview
        task={task({
          mode: "real",
          status: "PolicySubmitted",
          policy: realPolicy({ status: "submitted" })
        })}
        onSubmit={noop}
        onFund={noop}
        onTriggerDenial={noop}
        onCheckApproval={noop}
      />
    );

    expect(html).toContain("Check Policy Activation");
    expect(html).toContain("Wait for the Policy Signer policy to activate, then check again.");
  });

  it("renders real restricted signer denial details in the audit log", () => {
    const html = renderToStaticMarkup(
      <AuditLog
        task={task({
          mode: "real",
          status: "DeniedByPolicy",
          denial: {
            denied: true,
            exitCode: 5,
            attemptedAction: "transfer 0.001 USDC to 0x…dEaD",
            rawOutput: "Error: policy denied transfer (no transfer rule)"
          }
        })}
      />
    );

    expect(html).toContain("transfer 0.001 USDC to 0x…dEaD");
    expect(html).toContain("exit 5");
    expect(html).toContain("Error: policy denied transfer (no transfer rule)");
  });

  it("renders one timeline row per tx record with links for confirmed hashes", () => {
    const html = renderToStaticMarkup(
      <ExecutionTimeline
        task={task({
          mode: "real",
          status: "JobFunded",
          txRecords: [
            { label: "approve", policySignerRequestId: "signer_1", txHash: sampleTxHash, status: "confirmed" },
            { label: "createJob", policySignerRequestId: "signer_2", txHash: "", status: "pending" }
          ]
        })}
      />
    );

    expect(html).toContain("approve");
    expect(html).toContain("createJob");
    expect(html).toContain("confirmed");
    expect(html).toContain("pending");
    expect(html).toContain(
      `href="https://testnet.blockscout.injective.network/tx/${sampleTxHash}"`
    );
  });
});
