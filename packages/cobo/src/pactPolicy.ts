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
