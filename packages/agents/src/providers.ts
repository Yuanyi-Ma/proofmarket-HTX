import { buildPackageCommitment } from "@proofmarket/shared/src/merkle";
import type { ProviderAnswerPackage, ProviderId } from "@proofmarket/shared/src/types";

export type ProviderAnswerPackagePreimage = Omit<
  ProviderAnswerPackage,
  "packageHash"
>;

/**
 * packageHash = Merkle ROOT over the briefing leaves (leaf 0 = overview +
 * coverage statement, leaf 1..n = one 资料-建议 each; see shared/merkle.ts).
 * The provider signs this root on-chain at submit, so a single leaf can later
 * be proven part of the briefing with (leaf plaintext, Merkle path) — neither
 * challenge nor defense needs to reveal the rest of the briefing.
 */
export function hashProviderAnswerPackage(
  input: ProviderAnswerPackagePreimage
): string {
  return buildPackageCommitment(input).root;
}

// Briefing fixtures. Expert value = LICENSED libraries (IEEE Xplore / ACM DL /
// ScienceDirect + Messari Pro / Delphi Digital) — open archives like arXiv are
// things the user could query themselves. Block-STM is cited at its REAL ACM
// venue (PPoPP '23, doi:10.1145/3572848.3577524) because it doubles as the
// challenge counter-evidence and must stay verifiable; the other entries are
// demo fixtures (plausible titles, not real publications).
export function runProvider(
  taskId: string,
  providerId: ProviderId
): ProviderAnswerPackage {
  if (providerId === "execution-research-expert") {
    const preimage: ProviderAnswerPackagePreimage = {
      taskId,
      providerAgentId: 1,
      providerId,
      providerName: "区块链系统专家 Agent",
      // NOTE: the verifier's coverage check matches the literal "2021-2026"
      // substring in this statement — keep it intact when editing copy.
      coverageStatement:
        "本简报基于 IEEE Xplore / ACM Digital Library / Elsevier ScienceDirect 订阅论文库与 Messari Pro / Delphi Digital 行业研报库，覆盖 2021-2026 年区块链交易执行加速方向：并行执行、投机执行、冲突检测、状态访问优化、Block-STM、EVM 并行化、Sei、Sui 与 Solana 运行时。",
      answers: [
        {
          providerAnswer:
            "近年区块链执行加速研究集中在乐观并行执行、投机执行、冲突检测与状态访问优化，代表性工作是 Block-STM。",
          sourceTitle:
            "Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing",
          sourceLocator: "doi:10.1145/3572848.3577524",
          sourceLibrary: "acm-dl",
          sourceMetadata: { year: 2023, type: "paper" },
          excerptOrSummary:
            "Block-STM exploits optimistic concurrency control with a collaborative scheduler to execute ordered blockchain transactions in parallel while guaranteeing deterministic results.",
          relevanceExplanation:
            "支持把投机并行执行视为主要方向，但不能证明所有工作负载都能获得线性加速。"
        },
        {
          providerAnswer: "状态热点与存储访问开销是并行收益的主要约束。",
          sourceTitle:
            "Hot-State Partitioning: Reducing Storage Contention in Parallel Blockchain Runtimes",
          sourceLocator: "doi:10.1109/TPDS.2025.3412067",
          sourceLibrary: "ieee-xplore",
          sourceMetadata: { year: 2025, type: "paper" },
          excerptOrSummary:
            "Even when the scheduler admits full parallelism, contention on hot state keys and storage I/O can dominate end-to-end execution latency.",
          relevanceExplanation: "约束了对并行执行的过度宣称，解释了工作负载结构为何重要。"
        },
        {
          providerAnswer: "冲突预测可以把乐观执行的重试开销压到一成以内。",
          sourceTitle:
            "Adaptive Conflict Prediction for Optimistic Smart-Contract Execution",
          sourceLocator: "doi:10.1145/3651890.3672034",
          sourceLibrary: "acm-dl",
          sourceMetadata: { year: 2024, type: "paper" },
          excerptOrSummary:
            "An adaptive predictor trained on recent dependency graphs reduces re-execution overhead to under 10% across the studied workloads.",
          relevanceExplanation: "给出乐观执行落地时重试成本可控的量化依据。"
        },
        {
          providerAnswer: "依赖图测量显示公链负载天然具备高并行度。",
          sourceTitle:
            "A Measurement Study of Transaction Dependency Graphs on Public Blockchains",
          sourceLocator: "doi:10.1145/3589334.3645612",
          sourceLibrary: "acm-dl",
          sourceMetadata: { year: 2024, type: "paper" },
          excerptOrSummary:
            "Across one year of mainnet traces, the median block exhibits a dependency width that admits 8-16 way parallel execution.",
          relevanceExplanation: "为并行执行的理论上限提供实测支撑。"
        },
        {
          providerAnswer: "投机状态预取能掩盖存储延迟、提升 EVM 流水线吞吐。",
          sourceTitle:
            "SpecVM: Speculative State Prefetching for High-Throughput EVM Pipelines",
          sourceLocator: "doi:10.1109/ICDCS.2025.0214",
          sourceLibrary: "ieee-xplore",
          sourceMetadata: { year: 2025, type: "paper" },
          excerptOrSummary:
            "Speculative prefetching of state slots overlaps storage latency with execution and improves pipeline throughput by 2.3x on replayed mainnet blocks.",
          relevanceExplanation: "把存储瓶颈的缓解手段从调度层扩展到运行时层。"
        },
        {
          providerAnswer: "确定性调度让 BFT 执行层在并行下仍可复验。",
          sourceTitle:
            "Deterministic Scheduling of Conflicting Transactions in BFT Execution Layers",
          sourceLocator: "doi:10.1109/TC.2024.3398811",
          sourceLibrary: "ieee-xplore",
          sourceMetadata: { year: 2024, type: "paper" },
          excerptOrSummary:
            "A deterministic conflict-resolution order preserves replayability of parallel schedules across replicas in BFT settings.",
          relevanceExplanation: "回应并行化与共识层确定性要求之间的张力。"
        },
        {
          providerAnswer: "流水线化出块-执行重叠是低延迟链的通用手法。",
          sourceTitle:
            "Pipelined Block Construction and Execution in Low-Latency Blockchains",
          sourceLocator: "doi:10.1145/3620678.3624790",
          sourceLibrary: "acm-dl",
          sourceMetadata: { year: 2023, type: "paper" },
          excerptOrSummary:
            "Overlapping block construction with execution of the previous block hides scheduling latency and raises sustained throughput.",
          relevanceExplanation: "补充执行加速在系统层的协同优化路径。"
        },
        {
          providerAnswer: "产业侧 Sei v2 与 Monad 验证了并行 EVM 的工程可行性。",
          sourceTitle: "Sei v2 and the Parallelized EVM Landscape",
          sourceLocator: "messari:sei-v2-parallel-evm-2024",
          sourceLibrary: "messari-pro",
          sourceMetadata: { year: 2024, type: "report" },
          excerptOrSummary:
            "Paraphrase (subscription terms, no verbatim quote): Sei v2 overlaps transaction execution, state access and block commitment to keep hardware saturated, joining Monad in the optimistic-concurrency camp.",
          relevanceExplanation: "提供 EVM 并行化在生产环境落地的具体案例，而不止于研究原型。"
        },
        {
          providerAnswer: "研报口径同样把状态热点列为吞吐天花板的第一因素。",
          sourceTitle: "State Hotspots in High-Throughput Smart-Contract Execution",
          sourceLocator: "delphi:state-hotspots-2025",
          sourceLibrary: "delphi-digital",
          sourceMetadata: { year: 2025, type: "report" },
          excerptOrSummary:
            "Paraphrase (subscription terms, no verbatim quote): once contention on hot accounts crosses a modest threshold, serialization fallbacks erase most of the parallel speedup.",
          relevanceExplanation: "与学术侧结论交叉印证，增强可信度。"
        }
      ]
    };
    return {
      ...preimage,
      packageHash: hashProviderAnswerPackage(preimage)
    };
  }

  // Shallow provider: more volume than before but two real quality failures —
  // (a) answers[0]'s excerpt CONTRADICTS the local archived copy of the same
  // survey (查准 fail: the fabricated quote props up its consensus-and-hardware
  // thesis), and (b) Block-STM is missing despite the broad coverage claim
  // (查全 fail → CoverageMiss challenge).
  const shallow: ProviderAnswerPackagePreimage = {
    taskId,
    providerAgentId: 2,
    providerId,
    providerName: "文献速查 Agent",
    // NOTE: "2021-2026" must stay literal here too — the verifier uses it to
    // detect a broad coverage claim, which (without Block-STM) yields CoverageMiss.
    coverageStatement:
      "自报广泛覆盖 2021-2026 年区块链执行加速方向的学术论文（持有 IEEE Xplore / ACM Digital Library 订阅）。",
    answers: [
      {
        providerAnswer: "区块链性能的提升主要来自更好的共识机制与硬件。",
        sourceTitle: "A Survey of Blockchain Performance Optimization Techniques",
        sourceLocator: "doi:10.1109/COMST.2023.3310992",
        sourceLibrary: "ieee-xplore",
        sourceMetadata: { year: 2023, type: "paper" },
        excerptOrSummary:
          "The survey concludes that consensus upgrades and hardware improvements are the dominant sources of recent blockchain performance gains.",
        relevanceExplanation: "综述类来源，支撑共识与硬件主导的判断。"
      },
      {
        providerAnswer: "吞吐基准测试主要由共识参数决定。",
        sourceTitle: "Consensus Throughput Benchmarks Revisited",
        sourceLocator: "doi:10.1109/INFOCOM.2024.1187",
        sourceLibrary: "ieee-xplore",
        sourceMetadata: { year: 2024, type: "paper" },
        excerptOrSummary:
          "Benchmark variance is explained primarily by consensus parameters such as block interval and committee size.",
        relevanceExplanation: "支撑以共识为中心的性能叙事。"
      },
      {
        providerAnswer: "硬件加速对节点吞吐有直接收益。",
        sourceTitle: "Hardware Acceleration for Blockchain Transaction Processing",
        sourceLocator: "doi:10.1145/3579371.3589098",
        sourceLibrary: "acm-dl",
        sourceMetadata: { year: 2023, type: "paper" },
        excerptOrSummary:
          "FPGA offloading of signature verification yields up to 4x node-level throughput improvement.",
        relevanceExplanation: "硬件路线的代表性结果。"
      },
      {
        providerAnswer: "网络层优化缩短区块传播时间。",
        sourceTitle: "Network-Layer Optimizations for Block Propagation",
        sourceLocator: "doi:10.1109/TNET.2024.3356702",
        sourceLibrary: "ieee-xplore",
        sourceMetadata: { year: 2024, type: "paper" },
        excerptOrSummary:
          "Compact relay protocols reduce median block propagation delay by 38% on measured topologies.",
        relevanceExplanation: "网络层视角的性能改进。"
      },
      {
        providerAnswer: "分片是水平扩展吞吐的主要路径。",
        sourceTitle: "Sharding Approaches for Scalable Blockchain Systems: A Review",
        sourceLocator: "doi:10.1145/3571155.3571203",
        sourceLibrary: "acm-dl",
        sourceMetadata: { year: 2022, type: "paper" },
        excerptOrSummary:
          "Sharding partitions state and validators to scale throughput horizontally, at the cost of cross-shard coordination.",
        relevanceExplanation: "扩容路线综述，与执行层加速正交。"
      }
    ]
  };
  return {
    ...shallow,
    packageHash: hashProviderAnswerPackage(shallow)
  };
}
