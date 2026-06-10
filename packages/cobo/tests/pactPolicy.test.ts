import { describe, expect, it } from "vitest";
import { buildPactPolicy, createFixtureCoboClient } from "../src/index";
import { buildRealPactSubmission } from "../src/pactPolicy";

describe("buildPactPolicy", () => {
  it("builds the complete fixed Pact policy", () => {
    const policy = buildPactPolicy({
      escrowAddress: "0xEscrow",
      tokenAddress: "0xToken",
      challengeManagerAddress: "0xChallenge"
    });

    expect(policy).toEqual({
      intent: "Purchase evidence-backed provider answers for a blockchain execution acceleration research task.",
      totalBudget: "5 test USDC",
      perJobCap: "1 test USDC",
      allowedTargets: ["0xEscrow", "0xToken", "0xChallenge"],
      allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
      denyRules: ["direct transfer", "non-whitelisted target", "amount above cap", "expired pact"],
      expiresInMinutes: 30
    });
  });
});

describe("createFixtureCoboClient", () => {
  it("returns active status for submitted fixture pacts", async () => {
    const client = createFixtureCoboClient();

    await expect(client.getPactStatus("pact_fixture_001")).resolves.toEqual({
      pactId: "pact_fixture_001",
      status: "active"
    });
  });

  it("returns a deterministic denied transfer without shelling out", async () => {
    const client = createFixtureCoboClient();

    await expect(client.triggerDeniedTransfer()).resolves.toEqual({
      denied: true,
      reason:
        "Direct transfer rejected because target is not whitelisted and amount exceeds Pact cap.",
      attemptedTarget: "0xDeniedDirectTransfer",
      attemptedFunction: "transfer",
      attemptedAmount: "10 SETH",
      movedFunds: "0 test USDC"
    });
  });
});

describe("buildRealPactSubmission", () => {
  const input = {
    escrowAddress: "0x" + "4".repeat(40),
    tokenAddress: "0x" + "3".repeat(40),
    challengeManagerAddress: "0x" + "6".repeat(40),
    budgetAmount: "5",
    taskId: "task_001"
  };

  it("whitelists exactly escrow, token and challenge manager contracts on SETH", () => {
    const submission = buildRealPactSubmission(input);
    const policy = submission.policies[0];
    expect(policy.type).toBe("contract_call");
    expect(policy.rules.when.chain_in).toEqual(["SETH"]);
    expect(policy.rules.when.target_in).toEqual([
      { chain_id: "SETH", contract_addr: input.escrowAddress },
      { chain_id: "SETH", contract_addr: input.tokenAddress },
      { chain_id: "SETH", contract_addr: input.challengeManagerAddress }
    ]);
  });

  it("omits the challenge manager target when no address is provided (pre-P0-2 artifacts)", () => {
    const { challengeManagerAddress: _omit, ...withoutCm } = input;
    const submission = buildRealPactSubmission(withoutCm);
    expect(submission.policies[0].rules.when.target_in).toEqual([
      { chain_id: "SETH", contract_addr: input.escrowAddress },
      { chain_id: "SETH", contract_addr: input.tokenAddress }
    ]);
  });

  it("has no transfer policy so direct transfers are default-denied", () => {
    const submission = buildRealPactSubmission(input);
    expect(submission.policies.every((p) => p.type === "contract_call")).toBe(true);
  });

  it("caps tx count at 10 (success ~6 + challenge approve/openChallenge) and expires", () => {
    const submission = buildRealPactSubmission(input);
    expect(submission.completionConditions).toEqual([
      { type: "tx_count", threshold: "10" },
      { type: "time_elapsed", threshold: "5400" }
    ]);
    expect(
      submission.policies[0].rules.deny_if.usage_limits.rolling_24h.tx_count_gt
    ).toBe(10);
  });

  it("mentions the budget in intent and execution plan", () => {
    const submission = buildRealPactSubmission(input);
    expect(submission.intent).toContain("5 mUSDC");
    expect(submission.executionPlan).toContain("# Risk Controls");
  });
});
