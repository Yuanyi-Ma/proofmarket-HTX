import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChallengePanel } from "../components/ChallengePanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { ExecutionTimeline } from "../components/ExecutionTimeline";
import { FinalAnswer } from "../components/FinalAnswer";
import { PolicyReview } from "../components/PolicyReview";
import { ProcurementPlan } from "../components/ProcurementPlan";
import { ProviderMarket } from "../components/ProviderMarket";
import { TaskEntry } from "../components/TaskEntry";
import type { Task } from "@proofmarket/shared/src/types";

const requiredActionLabels = [
  "Create Task",
  "Generate Procurement Plan",
  "Submit Policy",
  "Fund Escrow",
  "Run Recommended Provider",
  "Run Low-Reputation Provider",
  "Verify Evidence",
  "Settle Payment",
  "Trigger Policy Signer Denial",
  "Uphold Challenge",
  "Refund or Slash"
];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "Settled",
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

describe("Task 9 browser-flow contract", () => {
  const noop = vi.fn();

  it("exposes the action labels used by the E2E task flows", () => {
    const html = renderToStaticMarkup(
      <>
        <TaskEntry task={null} onCreate={noop} />
        <ProcurementPlan task={null} onGenerate={noop} />
        <ProviderMarket task={null} onRunExpert={noop} onRunShallow={noop} />
        <PolicyReview
          task={null}
          onSubmit={noop}
          onFund={noop}
          onTriggerDenial={noop}
        />
        <EvidencePanel task={null} onVerify={noop} />
        <FinalAnswer task={null} onSettle={noop} />
        <ChallengePanel
          task={null}
          onWinChallenge={noop}
          onRefundOrSlash={noop}
        />
      </>
    );

    for (const label of requiredActionLabels) {
      expect(html).toContain(label);
    }
  });

  it("keeps the happy, challenge, and denial terminal states visible", () => {
    const html = renderToStaticMarkup(
      <>
        <ExecutionTimeline task={task()} />
        <ChallengePanel
          task={task({ status: "RefundedOrSlashed" })}
          onWinChallenge={noop}
          onRefundOrSlash={noop}
        />
        <ExecutionTimeline task={task({ status: "DeniedByPolicy" })} />
      </>
    );

    expect(html).toContain("Settled");
    expect(html).toContain("CoverageMiss");
    expect(html).toContain("RefundedOrSlashed");
    expect(html).toContain("Provider reputation decrease recorded.");
    expect(html).toContain("DeniedByPolicy");
    expect(html).toContain("ReturnedToEscrowPath");
  });
});
