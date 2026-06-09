import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChallengePanel } from "../components/ChallengePanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { ExecutionTimeline } from "../components/ExecutionTimeline";
import { FinalAnswer } from "../components/FinalAnswer";
import { PactReview } from "../components/PactReview";
import { ProviderMarket } from "../components/ProviderMarket";
import { TaskEntry } from "../components/TaskEntry";
import type { ProviderAnswerPackage, Task } from "@proofmarket/shared/src/types";

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
    budgetLimit: "5 test USDC",
    selectedProviderIds: [],
    plan: null,
    pact: null,
    providerPackage: null,
    audit: [],
    jobId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function timelineRowClass(html: string, state: string): string {
  const pattern = new RegExp(
    `<div class="timeline-row ([^"]+)">(?:(?!<div class="timeline-row).)*<strong>${state}</strong>`,
    "s"
  );

  return pattern.exec(html)?.[1] ?? "";
}

describe("ProofMarket workflow UI content", () => {
  const noop = vi.fn();

  it("renders the task entry empty state and required create action", () => {
    const html = renderToStaticMarkup(
      <TaskEntry task={null} onCreate={noop} isBusy={false} />
    );

    expect(html).toContain("Ask one research question that needs evidence");
    expect(html).toContain("Create task");
    expect(html).toContain("Generate procurement plan");
  });

  it("renders exactly three provider candidates with expert and shallow actions", () => {
    const html = renderToStaticMarkup(
      <ProviderMarket
        task={null}
        onRunExpert={noop}
        onRunShallow={noop}
      />
    );

    expect((html.match(/data-provider-card=/g) ?? [])).toHaveLength(3);
    expect(html).toContain("Execution Research Expert Agent");
    expect(html).toContain("Shallow Search Provider Agent");
    expect(html).toContain("General Web Summary Agent");
    expect(html).toContain("Run expert provider");
    expect(html).toContain("Run shallow provider");
  });

  it("renders Cobo boundaries and the CoverageMiss challenge path", () => {
    const pactHtml = renderToStaticMarkup(
      <PactReview task={null} onSubmit={noop} onFund={noop} onTriggerDenial={noop} />
    );
    const challengeHtml = renderToStaticMarkup(
      <ChallengePanel task={null} onWinChallenge={noop} onRefundOrSlash={noop} />
    );

    expect(pactHtml).toContain("5 test USDC");
    expect(pactHtml).toContain("Allowed targets");
    expect(pactHtml).toContain("Trigger Cobo denial");
    expect(challengeHtml).toContain("CoverageMiss");
    expect(challengeHtml).toContain("Block-STM");
    expect(challengeHtml).toContain("Win challenge");
    expect(challengeHtml).toContain("Refund or slash");
  });

  it("keeps branch timeline states inactive when a happy path task is settled", () => {
    const html = renderToStaticMarkup(
      <ExecutionTimeline task={task({ status: "Settled" })} />
    );

    expect(html).toContain("Happy path");
    expect(html).toContain("Challenge branch");
    expect(html).toContain("Denial branch");
    expect(html).toContain("DeniedByCobo");
    expect(html).toContain("Challenged");
    expect(html).toContain("not-taken");
    expect(timelineRowClass(html, "DeniedByCobo")).toBe("not-taken");
    expect(timelineRowClass(html, "Challenged")).toBe("not-taken");
  });

  it("shows ReturnedToEscrowPath on the denial branch after Cobo denial", () => {
    const html = renderToStaticMarkup(
      <ExecutionTimeline task={task({ status: "DeniedByCobo" })} />
    );

    expect(html).toContain("ReturnedToEscrowPath");
    expect(html).toContain("escrow can be funded next");
  });

  it("renders the current backend Cobo policy without masking mismatches", () => {
    const html = renderToStaticMarkup(
      <PactReview
        task={task({
          status: "PactActive",
          pact: {
            intent: "Backend intent",
            totalBudget: "5 test USDC",
            perJobCap: "1 test USDC",
            allowedTargets: [
              "ProofMarketEscrow",
              "MockUSDC",
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
              "expired pact"
            ],
            expiresInMinutes: 30,
            pactId: "pact_001",
            status: "active"
          }
        })}
        onSubmit={noop}
        onFund={noop}
        onTriggerDenial={noop}
      />
    );

    expect(html).toContain("ProofMarketEscrow, MockUSDC, ProofMarketChallengeManager");
    expect(html).toContain("createJob, fund, submit, complete, reject, approve");
    expect(html).toContain("direct transfer");
    expect(html).toContain("non-whitelisted target");
    expect(html).toContain("amount above cap");
    expect(html).toContain("expired pact");
  });

  it("does not render the normal research conclusion before verification", () => {
    const html = renderToStaticMarkup(
      <FinalAnswer
        task={task({ status: "Delivered", providerPackage })}
        onSettle={noop}
        isBusy={false}
      />
    );

    expect(html).toContain("Waiting for verified evidence");
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

    expect(html).toContain("Per-item verification status");
    expect(html).toContain("Verified");
    expect(html).toContain("Per-item package hash");
    expect(html).toContain("0xpackagehash");
  });

  it("allows a fresh task after one exists and disables creation while busy", () => {
    const existingTaskHtml = renderToStaticMarkup(
      <TaskEntry task={task()} onCreate={noop} isBusy={false} />
    );
    const busyHtml = renderToStaticMarkup(
      <TaskEntry task={null} onCreate={noop} isBusy />
    );

    expect(existingTaskHtml).toContain("Create fresh task");
    expect(existingTaskHtml).not.toMatch(/<button disabled[^>]*>Create fresh task/);
    expect(busyHtml).toMatch(/<button disabled[^>]*>Create task/);
  });
});
