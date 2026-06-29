export type RealPolicySubmissionInput = {
  escrowAddress: string;
  tokenAddress: string;
  /**
   * ChallengeManager address for the dispute path (approve deposit +
   * openChallenge). Optional: pre-P0-2 deployment artifacts lack the
   * contract, in which case the policy only covers the success path.
   */
  challengeManagerAddress?: string;
  budgetAmount: string; // human units, e.g. "5"
  taskId: string;
  network?: {
    policyChainId: string;
    label: string;
    assetSymbol: string;
  };
};

export type RealPolicySubmission = {
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

export function buildRealPolicySubmission(
  input: RealPolicySubmissionInput
): RealPolicySubmission {
  const network = input.network ?? {
    policyChainId: "SETH",
    label: "Sepolia",
    assetSymbol: "mUSDC"
  };
  const targets = [
    { chain_id: network.policyChainId, contract_addr: input.escrowAddress },
    { chain_id: network.policyChainId, contract_addr: input.tokenAddress },
    ...(input.challengeManagerAddress
      ? [{ chain_id: network.policyChainId, contract_addr: input.challengeManagerAddress }]
      : [])
  ];
  return {
    intent: `ProofMarket ${input.taskId}: fund one evidence procurement job, max ${input.budgetAmount} ${network.assetSymbol}, ${network.label} escrow only.`,
    executionPlan: [
      "# Summary",
      `Procure one evidence-backed research answer through ProofMarketEscrow within ${input.budgetAmount} ${network.assetSymbol}.`,
      "",
      "# Operations",
      `- MockUSDC.approve(escrow, ${input.budgetAmount} ${network.assetSymbol})`,
      "- ProofMarketEscrow.createJob(...)",
      `- ProofMarketEscrow.setBudget(jobId, ${input.budgetAmount} ${network.assetSymbol})`,
      `- ProofMarketEscrow.fund(jobId, ${input.budgetAmount} ${network.assetSymbol})`,
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
        ? `- Contract allowlist: ProofMarketEscrow + MockUSDC + ProofMarketChallengeManager on ${network.policyChainId} only`
        : `- Contract allowlist: ProofMarketEscrow + MockUSDC on ${network.policyChainId} only`,
      "- No transfer policy: any direct transfer is denied by default",
      "- Max 10 transactions, policy auto-expires after 90 minutes"
    ].join("\n"),
    policies: [
      {
        name: "proofmarket-escrow-calls",
        type: "contract_call",
        rules: {
          effect: "allow",
          when: {
            chain_in: [network.policyChainId],
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

export type PolicySignerPolicyInput = {
  escrowAddress: string;
  tokenAddress: string;
  challengeManagerAddress: string;
};

export type PolicySignerPolicy = {
  intent: string;
  totalBudget: string;
  perJobCap: string;
  allowedTargets: string[];
  allowedFunctions: string[];
  denyRules: string[];
  expiresInMinutes: number;
};

export function buildPolicySignerPolicy(input: PolicySignerPolicyInput): PolicySignerPolicy {
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
    denyRules: ["direct transfer", "non-whitelisted target", "amount above cap", "expired policy"],
    expiresInMinutes: 30
  };
}
