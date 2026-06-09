import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "../src/types";

const expectedPact = {
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
  ]
};

function loadFixture(fileName: string): Task {
  const url = new URL(`../../../data/fixtures/${fileName}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as Task;
}

describe("checked-in demo task fixtures", () => {
  it.each([
    ["happy-path.json", "Settled", "settled"],
    ["challenge-path.json", "RefundedOrSlashed", "refund_or_slash"],
    ["cobo-denial.json", "DeniedByCobo", "escrow_denied"]
  ] as const)(
    "keeps %s aligned with the task state machine and Pact vocabulary",
    (fileName, expectedStatus: TaskStatus, finalAuditType) => {
      const fixture = loadFixture(fileName);
      const serialized = JSON.stringify(fixture);

      expect(fixture.id).toBe("task_001");
      expect(fixture.status).toBe(expectedStatus);
      expect(fixture.audit.at(-1)?.type).toBe(finalAuditType);
      expect(fixture.pact).toMatchObject(expectedPact);
      expect(serialized).not.toContain("ProofMarketDemoEscrow");
      expect(serialized).not.toContain("settleJob");
      expect(serialized).not.toContain("slashProvider");
      expect(serialized).not.toContain("policy_denial");
    }
  );

  it("records a denial audit row that proves what was blocked and that funds did not move", () => {
    const fixture = loadFixture("cobo-denial.json");
    const denial = fixture.audit.at(-1);

    expect(fixture.jobId).toBeNull();
    expect(denial).toMatchObject({
      source: "cobo",
      type: "escrow_denied",
      result: "denied",
      txHash: null,
      jobId: null
    });
    expect(denial?.message).toContain(
      "Direct transfer rejected because target is not whitelisted"
    );
    expect(denial?.message).toContain("target=0xDeniedDirectTransfer");
    expect(denial?.message).toContain("function=transfer");
    expect(denial?.message).toContain("amount=10 SETH");
    expect(denial?.message).toContain("moved funds=0 test USDC");
    expect(denial?.message).toContain("no escrow job created");
  });
});
