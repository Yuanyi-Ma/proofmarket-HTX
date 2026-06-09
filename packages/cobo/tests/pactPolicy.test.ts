import { describe, expect, it } from "vitest";
import { buildPactPolicy, createFixtureCoboClient } from "../src/index";

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
