import type { ProcurementPlan } from "@proofmarket/shared/src/types";
import { normalizeLocale, type Locale } from "@proofmarket/shared/src/locale";

export function generateProcurementPlan(
  taskId: string,
  userQuestion: string,
  locale: Locale = "en"
): ProcurementPlan {
  if (normalizeLocale(locale) === "zh") {
    return {
      taskId,
      userQuestion,
      evidenceNeed:
        "这个问题需要专业资料支撑的深度回答——通用语料只能给出泛化结论。委托前只能依据各专家的【资料库资源】【是否有领域沉淀】【报价】【链上信誉 / 历史挑战记录】做概率判断：论文库 + 行业研报库双重授权、有领域沉淀、且链上零挑战成立的专家，交付完整证据服务包的概率最高。具体有没有漏检要等拿到证据服务包后由 Judge 核验——这里给的是委托前的最优下注，不是结论。",
      totalBudget: "5 USDC",
      perJobCap: "1 USDC",
      recommendedProviderId: "execution-research-expert",
      providerCount: 3,
      coverage:
        "2021-2026 年区块链执行加速方向：并行执行、投机执行、冲突检测、状态访问、Block-STM、EVM 并行化、Sei、Sui、Solana 运行时。",
      returnType: "provider-answer-package",
      verificationMethod:
        "核验者核对证据服务包中来源定位、摘录与结论的一致性、相关性说明以及覆盖声明。",
      candidates: [
        {
          providerId: "execution-research-expert",
          rank: 1,
          reason:
            "持有 IEEE Xplore / ACM DL / Elsevier ScienceDirect 论文库授权并订阅 Messari Pro 与 Delphi Digital 研报库，深耕执行加速方向且有领域沉淀，链上信誉最高、近 20 单零挑战成立——委托前看交付完整证据服务包的概率最高，报价仍在预算内。"
        },
        {
          providerId: "general-web-summary",
          rank: 2,
          reason:
            "自报专注共识与网络层、执行层论文覆盖有限——覆盖边界声明诚实、履约记录干净，可作补充，但对本问题的完整性概率有限。"
        },
        {
          providerId: "shallow-search-provider",
          rank: 3,
          reason:
            "自报资源与专家相当，但只做通用关键词检索、无领域沉淀，链上信誉偏低且有 3 次覆盖类挑战成立——交付完整性的先验风险最高。"
        }
      ]
    };
  }

  return {
    taskId,
    userQuestion,
    evidenceNeed:
      "This question needs authoritative evidence rather than a generic model answer. Before commissioning, the Client Agent can only judge providers probabilistically from declared database access, domain depth, price, on-chain reputation, and challenge history. The best prior is the provider with both academic and industry subscriptions, domain specialization, and no upheld challenges.",
    totalBudget: "5 USDC",
    perJobCap: "1 USDC",
    recommendedProviderId: "execution-research-expert",
    providerCount: 3,
    coverage:
      "2021-2026 blockchain execution acceleration: parallel execution, speculative execution, conflict detection, state access, Block-STM, EVM parallelization, Sei, Sui, and Solana runtimes.",
    returnType: "provider-answer-package",
    verificationMethod:
      "The verifier checks source locators, excerpt or paraphrase consistency, relevance explanations, and the Coverage Statement.",
    candidates: [
      {
        providerId: "execution-research-expert",
        rank: 1,
        reason:
          "Holds IEEE Xplore, ACM DL, and Elsevier ScienceDirect access plus Messari Pro and Delphi Digital subscriptions. Its execution-acceleration focus and strongest reputation make complete delivery most likely within budget."
      },
      {
        providerId: "general-web-summary",
        rank: 2,
        reason:
          "A credible comparison candidate with consensus and networking depth, but its execution-layer coverage is narrower than the recommended provider."
      },
      {
        providerId: "shallow-search-provider",
        rank: 3,
        reason:
          "Low price, but shallow keyword search, weaker reputation, and upheld coverage challenges make completeness risk materially higher."
      }
    ]
  };
}
