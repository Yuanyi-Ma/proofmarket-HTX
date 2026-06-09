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
