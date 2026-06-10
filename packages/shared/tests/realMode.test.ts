import { describe, expect, it } from "vitest";
import {
  parseDeploymentArtifact,
  validateResearchPlanOutput,
  ALLOWED_CHAIN_ACTIONS
} from "../src/realMode";

const goodArtifact = {
  chainId: 11155111,
  network: "sepolia",
  deployer: "0x" + "1".repeat(40),
  blockNumber: 123,
  coboWallet: "0x" + "2".repeat(40),
  contracts: {
    MockUSDC: "0x" + "3".repeat(40),
    ProofMarketEscrow: "0x" + "4".repeat(40)
  },
  mint: { to: "0x" + "2".repeat(40), rawAmount: "100000000", txHash: "0x" + "5".repeat(64) },
  deployedAt: "2026-06-10T00:00:00.000Z"
};

// P0-2 artifact: includes ChallengeManager and staking fields.
const goodArtifactWithCM = {
  ...goodArtifact,
  contracts: {
    ...goodArtifact.contracts,
    ProofMarketChallengeManager: "0x" + "6".repeat(40)
  },
  challengeManagerParams: {
    minStake: "10000000",
    challengeDeposit: "2000000",
    slashBps: "5000",
    slashRewardBps: "5000"
  },
  resolver:  "0x" + "7".repeat(40),
  treasury:  "0x" + "7".repeat(40),
  challenger: { address: "0x" + "8".repeat(40), mintedUsdc: "5000000" },
  providers: {
    "execution-research-expert": {
      address: "0x" + "9".repeat(40),
      mintedUsdc: "20000000",
      stakedAmount: "20000000",
      stakePending: false
    },
    "shallow-search-provider": {
      address: "0x" + "a".repeat(40),
      mintedUsdc: "20000000",
      stakedAmount: "0",
      stakePending: true,
      stakePendingReason: "No private key held by deploy script; provider self-stakes in P1"
    }
  }
};

const goodPlan = {
  taskId: "task_001",
  recommendedProviderId: "execution-research-expert",
  reason: "Catalog marks this provider as the execution research specialist.",
  maxPayment: "5",
  requiredEvidenceSchema: {
    minItems: 3,
    requiredFields: ["sourceTitle", "sourceLocator", "claim", "relevanceExplanation"]
  },
  chainActions: ["createJob", "fund", "submitEvidenceHash", "complete"]
};

describe("parseDeploymentArtifact", () => {
  it("accepts a valid artifact", () => {
    expect(parseDeploymentArtifact(goodArtifact).contracts.ProofMarketEscrow).toBe(
      goodArtifact.contracts.ProofMarketEscrow
    );
  });

  it("rejects a wrong chainId", () => {
    expect(() => parseDeploymentArtifact({ ...goodArtifact, chainId: 1 })).toThrow(
      /chainId/
    );
  });

  it("rejects malformed addresses", () => {
    expect(() =>
      parseDeploymentArtifact({
        ...goodArtifact,
        contracts: { ...goodArtifact.contracts, MockUSDC: "0x123" }
      })
    ).toThrow(/address/);
  });

  // ── P0-2 ChallengeManager fields ──────────────────────────────────────────

  it("accepts a P0-2 artifact with ChallengeManager and staking fields", () => {
    const result = parseDeploymentArtifact(goodArtifactWithCM);
    expect(result.contracts.ProofMarketChallengeManager).toBe(
      goodArtifactWithCM.contracts.ProofMarketChallengeManager
    );
    expect(result.resolver).toBe(goodArtifactWithCM.resolver);
    expect(result.providers?.["execution-research-expert"]?.stakePending).toBe(false);
    expect(result.providers?.["shallow-search-provider"]?.stakePending).toBe(true);
  });

  it("accepts a pre-P0-2 artifact without ChallengeManager (backwards compat)", () => {
    // goodArtifact has no ProofMarketChallengeManager — must still parse OK.
    const result = parseDeploymentArtifact(goodArtifact);
    expect(result.contracts.ProofMarketChallengeManager).toBeUndefined();
  });

  it("rejects a malformed ChallengeManager address", () => {
    expect(() =>
      parseDeploymentArtifact({
        ...goodArtifactWithCM,
        contracts: { ...goodArtifactWithCM.contracts, ProofMarketChallengeManager: "0x123" }
      })
    ).toThrow(/ProofMarketChallengeManager/);
  });

  it("rejects a malformed resolver address", () => {
    expect(() =>
      parseDeploymentArtifact({ ...goodArtifactWithCM, resolver: "not-an-address" })
    ).toThrow(/resolver/);
  });

  it("rejects a malformed treasury address", () => {
    expect(() =>
      parseDeploymentArtifact({ ...goodArtifactWithCM, treasury: "bad" })
    ).toThrow(/treasury/);
  });

  it("rejects a malformed challenger address", () => {
    expect(() =>
      parseDeploymentArtifact({
        ...goodArtifactWithCM,
        challenger: { address: "0xinvalid", mintedUsdc: "5000000" }
      })
    ).toThrow(/challenger/);
  });

  it("rejects a malformed provider address in providers map", () => {
    expect(() =>
      parseDeploymentArtifact({
        ...goodArtifactWithCM,
        providers: {
          ...goodArtifactWithCM.providers,
          "bad-provider": { address: "not-hex", mintedUsdc: "0", stakedAmount: "0", stakePending: true }
        }
      })
    ).toThrow(/providers\["bad-provider"\]/);
  });
});

describe("validateResearchPlanOutput", () => {
  const catalogIds = ["execution-research-expert", "shallow-search-provider"];

  it("accepts a valid plan", () => {
    const plan = validateResearchPlanOutput(goodPlan, {
      taskId: "task_001",
      budgetAmount: "5",
      providerIds: catalogIds
    });
    expect(plan.recommendedProviderId).toBe("execution-research-expert");
  });

  it("rejects unknown provider", () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, recommendedProviderId: "made-up" },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/provider/i);
  });

  it("rejects maxPayment above budget", () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, maxPayment: "6" },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/budget/i);
  });

  it("rejects chain actions outside the allowed set", () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, chainActions: ["createJob", "selfdestruct"] },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/action/i);
  });

  it("rejects output that smuggles a contract address", () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, reason: "send to 0x" + "a".repeat(40) },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/address/i);
  });

  it("exposes the allowed action set", () => {
    expect(ALLOWED_CHAIN_ACTIONS).toEqual([
      "createJob",
      "fund",
      "submitEvidenceHash",
      "complete"
    ]);
  });

  it('rejects maxPayment "0" with positive finite message', () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, maxPayment: "0" },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/positive finite/i);
  });

  it('rejects maxPayment "abc" with positive finite message', () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, maxPayment: "abc" },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/positive finite/i);
  });

  it("rejects undefined requiredEvidenceSchema", () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, requiredEvidenceSchema: undefined as any },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/requiredEvidenceSchema/i);
  });

  it("rejects empty chainActions with must not be empty message", () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, chainActions: [] },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/must not be empty/i);
  });

  it("does not reject a reason containing a 64-char tx hash", () => {
    const plan = validateResearchPlanOutput(
      { ...goodPlan, reason: "see tx 0x" + "a".repeat(64) },
      { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
    );
    expect(plan.reason).toContain("0x");
  });

  it("rejects plan with wrong taskId", () => {
    expect(() =>
      validateResearchPlanOutput(
        { ...goodPlan, taskId: "task_999" },
        { taskId: "task_001", budgetAmount: "5", providerIds: catalogIds }
      )
    ).toThrow(/mismatch/i);
  });
});
