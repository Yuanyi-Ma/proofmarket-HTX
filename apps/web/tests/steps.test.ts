import { describe, expect, it } from "vitest";

import { STEPS, stepFor, stepStatus } from "../lib/steps";
import type { Task, TaskStatus } from "@proofmarket/shared/src/types";

function task(status: TaskStatus): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status,
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
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("STEPS", () => {
  it("defines the six wizard steps in order with Chinese titles", () => {
    expect(STEPS.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(STEPS.map((s) => s.title)).toEqual([
      "提出问题",
      "采购方案",
      "授权支付",
      "链上采购",
      "证据核验",
      "完成结算"
    ]);
  });
});

describe("stepFor", () => {
  const expected: Record<TaskStatus, number> = {
    Created: 1,
    Planned: 2,
    PactSubmitted: 3,
    PactActive: 3,
    PactRejected: 3,
    DeniedByCobo: 3,
    JobFunded: 4,
    Delivered: 5,
    Verified: 6,
    Challenged: 5,
    ChallengeWon: 5,
    ChallengeLost: 5,
    RefundedOrSlashed: 5,
    Settled: 6,
    Audited: 6
  };

  it("maps no task to step 1", () => {
    expect(stepFor(null)).toBe(1);
  });

  for (const [status, step] of Object.entries(expected) as [TaskStatus, number][]) {
    it(`maps ${status} to step ${step}`, () => {
      expect(stepFor(task(status))).toBe(step);
    });
  }

  it("keeps DeniedByCobo on step 3 (denial result, not progress)", () => {
    expect(stepFor(task("DeniedByCobo"))).toBe(3);
  });
});

describe("stepStatus", () => {
  it("marks done/current/upcoming around the derived step", () => {
    const funded = task("JobFunded"); // step 4
    expect(stepStatus(funded, 1)).toBe("done");
    expect(stepStatus(funded, 2)).toBe("done");
    expect(stepStatus(funded, 3)).toBe("done");
    expect(stepStatus(funded, 4)).toBe("current");
    expect(stepStatus(funded, 5)).toBe("upcoming");
    expect(stepStatus(funded, 6)).toBe("upcoming");
  });

  it("treats an empty workspace as step 1 current with everything upcoming", () => {
    expect(stepStatus(null, 1)).toBe("current");
    expect(stepStatus(null, 2)).toBe("upcoming");
    expect(stepStatus(null, 6)).toBe("upcoming");
  });
});
