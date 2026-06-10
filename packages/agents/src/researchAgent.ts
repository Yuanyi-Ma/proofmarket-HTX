import type { ProcurementPlan } from "@proofmarket/shared/src/types";

export function generateProcurementPlan(
  taskId: string,
  userQuestion: string
): ProcurementPlan {
  return {
    taskId,
    userQuestion,
    evidenceNeed:
      "该问题询问的是最新研究进展，需要能指出具体执行加速机制及其局限的一手来源。",
    totalBudget: "5 test USDC",
    perJobCap: "1 test USDC",
    recommendedProviderId: "execution-research-expert",
    providerCount: 3,
    coverage:
      "2021-2026 年区块链执行加速方向：并行执行、投机执行、冲突检测、状态访问、Block-STM、EVM 并行化、Sei、Sui、Solana 运行时。",
    returnType: "provider-answer-package",
    verificationMethod:
      "验证者核对来源定位、摘录与摘要的一致性、相关性说明以及覆盖声明。"
  };
}
