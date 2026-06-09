import type { ProcurementPlan } from "@proofmarket/shared/src/types";

export function generateProcurementPlan(
  taskId: string,
  userQuestion: string
): ProcurementPlan {
  return {
    taskId,
    userQuestion,
    evidenceNeed:
      "The question asks for recent research progress and needs sources that identify concrete execution-acceleration mechanisms and their limits.",
    totalBudget: "5 test USDC",
    perJobCap: "1 test USDC",
    recommendedProviderId: "execution-research-expert",
    providerCount: 3,
    coverage:
      "2021-2026 blockchain execution acceleration: parallel execution, speculative execution, conflict detection, state access, Block-STM, EVM parallelization, Sei, Sui, Solana runtime.",
    returnType: "provider-answer-package",
    verificationMethod:
      "Verifier checks source locators, excerpt or summary alignment, relevance explanation, and coverage statement."
  };
}
