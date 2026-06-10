import { stableHash, type JsonValue } from "@proofmarket/shared/src/hash";
import type { ProviderAnswerPackage, ProviderId } from "@proofmarket/shared/src/types";

export type ProviderAnswerPackagePreimage = Omit<
  ProviderAnswerPackage,
  "packageHash"
>;

export function hashProviderAnswerPackage(
  input: ProviderAnswerPackagePreimage
): string {
  const hashInput = {
    taskId: input.taskId,
    providerAgentId: input.providerAgentId,
    providerId: input.providerId,
    providerName: input.providerName,
    coverageStatement: input.coverageStatement,
    answers: input.answers.map((answer) => ({
      providerAnswer: answer.providerAnswer,
      sourceTitle: answer.sourceTitle,
      sourceLocator: answer.sourceLocator,
      sourceMetadata: {
        year: answer.sourceMetadata.year,
        type: answer.sourceMetadata.type
      },
      excerptOrSummary: answer.excerptOrSummary,
      relevanceExplanation: answer.relevanceExplanation
    }))
  } satisfies JsonValue;

  return stableHash(hashInput);
}

export function runProvider(
  taskId: string,
  providerId: ProviderId
): ProviderAnswerPackage {
  if (providerId === "execution-research-expert") {
    const preimage: ProviderAnswerPackagePreimage = {
      taskId,
      providerAgentId: 1,
      providerId,
      providerName: "执行加速研究专家 Agent",
      // NOTE: the verifier's coverage check matches the literal "2021-2026"
      // substring in this statement — keep it intact when editing copy.
      coverageStatement:
        "已检索 2021-2026 年区块链交易执行加速方向的来源，覆盖并行执行、投机执行、冲突检测、状态访问优化、Block-STM、EVM 并行化、Sei、Sui 与 Solana 运行时。",
      answers: [
        {
          providerAnswer:
            "近年区块链执行加速研究集中在乐观并行执行、投机执行、冲突检测与状态访问优化。",
          sourceTitle:
            "Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing",
          sourceLocator: "arXiv:2203.06871",
          sourceMetadata: { year: 2022, type: "paper" },
          excerptOrSummary:
            "Block-STM 利用乐观并行执行与冲突检测，在保持确定性结果的前提下并发执行有序的区块链交易。",
          relevanceExplanation:
            "支持把投机并行执行视为主要方向，但不能证明所有工作负载都能获得线性加速。"
        },
        {
          providerAnswer:
            "执行加速受交易冲突、状态热点与存储访问开销的限制。",
          sourceTitle: "高吞吐智能合约执行中的状态热点",
          sourceLocator: "mock-report:state-hotspots-2025",
          sourceMetadata: { year: 2025, type: "report" },
          excerptOrSummary:
            "即使调度允许并行执行，状态热点与存储 I/O 仍可能主导执行延迟。",
          relevanceExplanation:
            "约束了对并行执行的过度宣称，并解释了工作负载结构为何重要。"
        },
        {
          providerAnswer:
            "Sei v2 与 Monad 的 EVM 并行化通过乐观并发与流水线化的执行阶段获得显著吞吐提升。",
          sourceTitle: "Sei v2：并行化 EVM 执行",
          sourceLocator: "mock-report:sei-v2-parallel-evm-2024",
          sourceMetadata: { year: 2024, type: "report" },
          excerptOrSummary:
            "Sei v2 引入并行化 EVM，将交易执行、状态访问与区块提交流水线化，以最大化硬件利用率。",
          relevanceExplanation:
            "提供了 EVM 并行化在生产环境落地的具体案例，而不止于研究原型。"
        }
      ]
    };
    return {
      ...preimage,
      packageHash: hashProviderAnswerPackage(preimage)
    };
  }

  const shallow: ProviderAnswerPackagePreimage = {
    taskId,
    providerAgentId: 2,
    providerId,
    providerName: "浅层检索 Provider Agent",
    // NOTE: "2021-2026" must stay literal here too — the verifier uses it to
    // detect a broad coverage claim, which (without Block-STM) yields CoverageMiss.
    coverageStatement:
      "声称广泛覆盖 2021-2026 年区块链执行加速方向的论文。",
    answers: [
      {
        providerAnswer:
          "区块链性能的提升主要来自更好的共识机制与硬件。",
        sourceTitle: "通用区块链性能综述",
        sourceLocator: "mock-web:generic-performance-overview",
        sourceMetadata: { year: 2024, type: "report" },
        excerptOrSummary:
          "对吞吐量与共识性能的通用公开网页摘要。",
        relevanceExplanation:
          "与区块链性能相关，但遗漏了 Block-STM 等执行层专项工作。"
      }
    ]
  };
  return {
    ...shallow,
    packageHash: hashProviderAnswerPackage(shallow)
  };
}
