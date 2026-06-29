import { describe, expect, it } from "vitest";
import { buildPolicySignerPolicy, createFixturePolicySignerClient } from "../src/index";
import { buildRealPolicySubmission } from "../src/policy";

describe("buildPolicySignerPolicy", () => {
  it("builds the complete fixed Policy policy", () => {
    const policy = buildPolicySignerPolicy({
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
      denyRules: ["direct transfer", "non-whitelisted target", "amount above cap", "expired policy"],
      expiresInMinutes: 30
    });
  });
});

describe("createFixturePolicySignerClient", () => {
  it("returns active status for submitted fixture policies", async () => {
    const client = createFixturePolicySignerClient();

    await expect(client.getPolicyStatus("policy_fixture_001")).resolves.toEqual({
      policyId: "policy_fixture_001",
      status: "active"
    });
  });

  it("returns a deterministic denied transfer without shelling out", async () => {
    const client = createFixturePolicySignerClient();

    await expect(client.triggerDeniedTransfer()).resolves.toEqual({
      denied: true,
      reason:
        "Direct transfer rejected because target is not whitelisted and amount exceeds Policy cap.",
      attemptedTarget: "0xDeniedDirectTransfer",
      attemptedFunction: "transfer",
      attemptedAmount: "10 SETH",
      movedFunds: "0 test USDC"
    });
  });
});

describe("buildRealPolicySubmission", () => {
  const input = {
    escrowAddress: "0x" + "4".repeat(40),
    tokenAddress: "0x" + "3".repeat(40),
    challengeManagerAddress: "0x" + "6".repeat(40),
    budgetAmount: "5",
    taskId: "task_001"
  };

  it("whitelists exactly escrow, token and challenge manager contracts on SETH", () => {
    const submission = buildRealPolicySubmission(input);
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
    const submission = buildRealPolicySubmission(withoutCm);
    expect(submission.policies[0].rules.when.target_in).toEqual([
      { chain_id: "SETH", contract_addr: input.escrowAddress },
      { chain_id: "SETH", contract_addr: input.tokenAddress }
    ]);
  });

  it("has no transfer policy so direct transfers are default-denied", () => {
    const submission = buildRealPolicySubmission(input);
    expect(submission.policies.every((p) => p.type === "contract_call")).toBe(true);
  });

  it("can target Injective EVM testnet without Sepolia labels", () => {
    const submission = buildRealPolicySubmission({
      ...input,
      network: {
        policyChainId: "injective-evm-testnet",
        label: "Injective EVM testnet",
        assetSymbol: "USDC"
      }
    });

    expect(submission.policies[0].rules.when.chain_in).toEqual([
      "injective-evm-testnet"
    ]);
    expect(submission.policies[0].rules.when.target_in).toEqual([
      { chain_id: "injective-evm-testnet", contract_addr: input.escrowAddress },
      { chain_id: "injective-evm-testnet", contract_addr: input.tokenAddress },
      { chain_id: "injective-evm-testnet", contract_addr: input.challengeManagerAddress }
    ]);
    expect(submission.intent).toContain("Injective EVM testnet");
    expect(submission.intent).toContain("5 USDC");
    expect(submission.executionPlan).not.toContain("Sepolia");
    expect(submission.executionPlan).not.toContain("mUSDC");
    expect(submission.executionPlan).not.toContain("SETH");
  });

  it("caps tx count at 10 (success ~6 + challenge approve/openChallenge) and expires", () => {
    const submission = buildRealPolicySubmission(input);
    expect(submission.completionConditions).toEqual([
      { type: "tx_count", threshold: "10" },
      { type: "time_elapsed", threshold: "5400" }
    ]);
    expect(
      submission.policies[0].rules.deny_if.usage_limits.rolling_24h.tx_count_gt
    ).toBe(10);
  });

  it("mentions the budget in intent and execution plan", () => {
    const submission = buildRealPolicySubmission(input);
    expect(submission.intent).toContain("5 mUSDC");
    expect(submission.executionPlan).toContain("# Risk Controls");
  });
});
