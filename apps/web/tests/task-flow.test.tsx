import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChallengePanel } from "../components/ChallengePanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { ExecutionTimeline } from "../components/ExecutionTimeline";
import { FinalAnswer } from "../components/FinalAnswer";
import { PactReview } from "../components/PactReview";
import { ProcurementPlan } from "../components/ProcurementPlan";
import { ProviderMarket } from "../components/ProviderMarket";
import { TaskEntry } from "../components/TaskEntry";
import type { Task } from "@proofmarket/shared/src/types";

const requiredActionLabels = [
  "Create task",
  "Generate procurement plan",
  "Submit Pact",
  "Fund escrow",
  "Run expert provider",
  "Run shallow provider",
  "Verify evidence",
  "Release payment",
  "Trigger Cobo denial",
  "Win challenge",
  "Refund or slash"
];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "Settled",
    budgetLimit: "5 test USDC",
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
        <PactReview
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
        <ExecutionTimeline task={task({ status: "DeniedByCobo" })} />
      </>
    );

    expect(html).toContain("Settled");
    expect(html).toContain("CoverageMiss");
    expect(html).toContain("RefundedOrSlashed");
    expect(html).toContain("Provider reputation decrease recorded.");
    expect(html).toContain("DeniedByCobo");
    expect(html).toContain("ReturnedToEscrowPath");
  });
});
