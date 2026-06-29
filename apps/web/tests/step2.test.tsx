import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Step2Plan } from "../components/steps/Step2Plan";
import type { ProcurementPlan, Task } from "@proofmarket/shared/src/types";

const noop = vi.fn();

/** Minimal complete ProcurementPlan without providerReputations, matching fixture mode. */
function basePlan(overrides: Partial<ProcurementPlan> = {}): ProcurementPlan {
  return {
    taskId: "task_001",
    userQuestion: "Research blockchain transaction execution acceleration.",
    evidenceNeed: "Needs primary 2021-2026 execution acceleration literature evidence.",
    totalBudget: "5 USDC",
    perJobCap: "1 USDC",
    recommendedProviderId: "execution-research-expert",
    providerCount: 3,
    coverage: "Block-STM, parallel execution, conflict detection.",
    returnType: "provider-answer-package",
    verificationMethod: "Verifier checks locators, excerpts, relevance, coverage.",
    ...overrides
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Research blockchain transaction execution acceleration.",
    status: "Planned",
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

describe("Step2Plan — provider reputation source display", () => {
  it("real mode: plan.providerReputations with erc8004 entries shows on-chain scores and tag", () => {
    const realPlan = basePlan({
      providerReputations: [
        { providerId: "execution-research-expert", score: 980, source: "erc8004" },
        { providerId: "shallow-search-provider",   score: 720, source: "erc8004" },
        { providerId: "general-web-summary",        score: 830, source: "erc8004" }
      ]
    });

    const html = renderToStaticMarkup(
      <Step2Plan
        task={task({ mode: "real", plan: realPlan })}
        onConfirm={noop}
      />
    );

    const badgeCount = (html.match(/chain-rep-tag/g) ?? []).length;
    expect(badgeCount).toBe(3);

    expect(html).toContain("980");
    expect(html).toContain("720");
    expect(html).toContain("830");

    expect(html).toContain('class="chain-rep-tag"');
  });

  it("fixture mode: plan without providerReputations falls back to local providerProfiles scores without on-chain tag", () => {
    const fixturePlan = basePlan();

    const html = renderToStaticMarkup(
      <Step2Plan
        task={task({ mode: "fixture", plan: fixturePlan })}
        onConfirm={noop}
      />
    );

    expect(html).not.toContain("chain-rep-tag");

    expect(html).toContain("970");
    expect(html).toContain("620");
    expect(html).toContain("800");
  });

  it("does not show the on-chain tag when providerReputations source is not erc8004", () => {
    const mixedPlan = basePlan({
      providerReputations: [
        { providerId: "execution-research-expert", score: 970, source: "fixture" }
      ]
    });

    const html = renderToStaticMarkup(
      <Step2Plan
        task={task({ mode: "real", plan: mixedPlan })}
        onConfirm={noop}
      />
    );

    expect(html).not.toContain("chain-rep-tag");
  });
});

describe("Step2Plan — structured challenge counts", () => {
  it("candidate cards show structured challenge counts with no-record state", () => {
    const markup = renderToStaticMarkup(
      <Step2Plan task={task({ plan: basePlan() })} onConfirm={noop} />
    );
    expect(markup).toContain("No challenge record");
    expect(markup).toContain("5 challenges / 3 upheld");
    expect(markup).toContain("1 challenges / 0 upheld");
  });
});

describe("Step2Plan — product-first purchase summary", () => {
  it("shows a concise buying decision summary before protocol details", () => {
    const markup = renderToStaticMarkup(
      <Step2Plan task={task({ plan: basePlan() })} onConfirm={noop} />
    );

    expect(markup).toContain("Purchase decision");
    expect(markup).toContain("Expected deliverable");
    expect(markup).toContain("Why recommended");
    expect(markup).toContain("expected payment");
    expect(markup).not.toContain("Requirements analysis");
  });
});
