export type RealPactSubmissionInput = {
  escrowAddress: string;
  tokenAddress: string;
  /**
   * ChallengeManager address for the dispute path (approve deposit +
   * openChallenge). Optional: pre-P0-2 deployment artifacts lack the
   * contract, in which case the pact only covers the success path.
   */
  challengeManagerAddress?: string;
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
  const targets = [
    { chain_id: "SETH", contract_addr: input.escrowAddress },
    { chain_id: "SETH", contract_addr: input.tokenAddress },
    ...(input.challengeManagerAddress
      ? [{ chain_id: "SETH", contract_addr: input.challengeManagerAddress }]
      : [])
  ];
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
      ...(input.challengeManagerAddress
        ? [
            "- MockUSDC.approve(challengeManager, challengeDeposit) [dispute path]",
            "- ProofMarketChallengeManager.openChallenge(jobId, challengeType, challengeHash) [dispute path]"
          ]
        : []),
      "",
      "# Risk Controls",
      input.challengeManagerAddress
        ? "- Contract allowlist: ProofMarketEscrow + MockUSDC + ProofMarketChallengeManager on SETH only"
        : "- Contract allowlist: ProofMarketEscrow + MockUSDC on SETH only",
      "- No transfer policy: any direct transfer is denied by default",
      "- Max 10 transactions, pact auto-expires after 90 minutes"
    ].join("\n"),
    policies: [
      {
        name: "proofmarket-escrow-calls",
        type: "contract_call",
        rules: {
          effect: "allow",
          when: {
            chain_in: ["SETH"],
            target_in: targets
          },
          // 10 = success path (~6: approve/createJob/setBudget/fund/complete +
          // headroom) + challenge path (approveDeposit + openChallenge).
          deny_if: { usage_limits: { rolling_24h: { tx_count_gt: 10 } } }
        }
      }
    ],
    completionConditions: [
      { type: "tx_count", threshold: "10" },
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
