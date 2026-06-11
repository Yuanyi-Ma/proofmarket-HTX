import type { ProcurementPlan } from "@proofmarket/shared/src/types";

export function generateProcurementPlan(
  taskId: string,
  userQuestion: string
): ProcurementPlan {
  return {
    taskId,
    userQuestion,
    evidenceNeed:
      "这个问题要的是同行评审论文级别的证据。采购前只能依据各来源的【论文库资源】【是否有精炼沉淀】【报价】【链上信誉 / 历史挑战记录】做概率判断：同时接入 IEEE + Elsevier、有沉淀、且链上零挑战成立的来源，命中完整证据的概率最高。具体有没有漏检要等拿到证据包后由 Judge 核验——这里给的是采购前的最优下注，不是结论。",
    totalBudget: "5 mUSDC",
    perJobCap: "1 mUSDC",
    recommendedProviderId: "execution-research-expert",
    providerCount: 3,
    coverage:
      "2021-2026 年区块链执行加速方向：并行执行、投机执行、冲突检测、状态访问、Block-STM、EVM 并行化、Sei、Sui、Solana 运行时。",
    returnType: "provider-answer-package",
    verificationMethod:
      "验证者核对来源定位、摘录与摘要的一致性、相关性说明以及覆盖声明。",
    candidates: [
      {
        providerId: "execution-research-expert",
        rank: 1,
        reason:
          "同时接入 IEEE 与 Elsevier 论文库、覆盖执行加速方向的同行评审论文且有精炼沉淀，链上信誉最高、近 20 单零挑战成立——采购前看命中完整证据的概率最高，报价仍在预算内。"
      },
      {
        providerId: "general-web-summary",
        rank: 2,
        reason:
          "仅接入 IEEE 单库、自报只能部分覆盖执行加速方向；胜在履约记录干净，可作补充，但覆盖完整性的概率有限。"
      },
      {
        providerId: "shallow-search-provider",
        rank: 3,
        reason:
          "自报资源与专家相当，但只做原始检索、无精炼沉淀，链上信誉偏低且有 3 次覆盖类挑战成立——交付完整性的先验风险最高。"
      }
    ]
  };
}
