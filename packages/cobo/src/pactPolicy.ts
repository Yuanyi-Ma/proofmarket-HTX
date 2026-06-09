export type RealPactSubmissionInput = {
  escrowAddress: string;
  tokenAddress: string;
  budgetAmount: string; // human units, e.g. "5"
  taskId: string;
};

export type RealPactSubmission = {
  intent: string;
  executionPlan: string;
  policies: Array<{
    name: string;
    type: "contract_call";
    rules: {
      effect: "allow";
      when: {
        chain_in: string[];
        target_in: Array<{ chain_id: string; contract_addr: string }>;
      };
      deny_if: { usage_limits: { rolling_24h: { tx_count_gt: number } } };
    };
  }>;
  completionConditions: Array<{ type: string; threshold: string }>;
};

export function buildRealPactSubmission(
  input: RealPactSubmissionInput
): RealPactSubmission {
  return {
    intent: `ProofMarket ${input.taskId}: fund one evidence procurement job, max ${input.budgetAmount} mUSDC, Sepolia escrow only.`,
    executionPlan: [
      "# Summary",
      `Procure one evidence-backed research answer through ProofMarketEscrow within ${input.budgetAmount} mUSDC.`,
      "",
      "# Operations",
      `- MockUSDC.approve(escrow, ${input.budgetAmount} mUSDC)`,
      "- ProofMarketEscrow.createJob(...)",
      `- ProofMarketEscrow.setBudget(jobId, ${input.budgetAmount} mUSDC)`,
      `- ProofMarketEscrow.fund(jobId, ${input.budgetAmount} mUSDC)`,
      "- ProofMarketEscrow.complete(jobId, verdictHash) after verifier acceptance",
      "",
      "# Risk Controls",
      "- Contract allowlist: ProofMarketEscrow + MockUSDC on SETH only",
      "- No transfer policy: any direct transfer is denied by default",
      "- Max 7 transactions, pact auto-expires after 90 minutes"
    ].join("\n"),
    policies: [
      {
        name: "proofmarket-escrow-calls",
        type: "contract_call",
        rules: {
          effect: "allow",
          when: {
            chain_in: ["SETH"],
            target_in: [
              { chain_id: "SETH", contract_addr: input.escrowAddress },
              { chain_id: "SETH", contract_addr: input.tokenAddress }
            ]
          },
          deny_if: { usage_limits: { rolling_24h: { tx_count_gt: 7 } } }
        }
      }
    ],
    completionConditions: [
      { type: "tx_count", threshold: "7" },
      { type: "time_elapsed", threshold: "5400" }
    ]
  };
}

export type PactPolicyInput = {
  escrowAddress: string;
  tokenAddress: string;
  challengeManagerAddress: string;
};

export type PactPolicy = {
  intent: string;
  totalBudget: string;
  perJobCap: string;
  allowedTargets: string[];
  allowedFunctions: string[];
  denyRules: string[];
  expiresInMinutes: number;
};

export function buildPactPolicy(input: PactPolicyInput): PactPolicy {
  return {
    intent: "Purchase evidence-backed provider answers for a blockchain execution acceleration research task.",
    totalBudget: "5 test USDC",
    perJobCap: "1 test USDC",
    allowedTargets: [
      input.escrowAddress,
      input.tokenAddress,
      input.challengeManagerAddress
    ],
    allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
    denyRules: ["direct transfer", "non-whitelisted target", "amount above cap", "expired pact"],
    expiresInMinutes: 30
  };
}
