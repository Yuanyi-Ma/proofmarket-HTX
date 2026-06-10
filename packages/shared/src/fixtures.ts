import type { ProviderProfile } from "./types";

export const defaultQuestion = "请调研近几年区块链交易执行加速的最新研究进展。";

/**
 * Preset counter-evidence for the deterministic challenge flow (P2-c).
 * The challenge content is fixed by design — the protocol and fund movements
 * are real, the arbitration content is preset. Only its stableHash goes
 * on-chain; this object is the off-chain audit-layer original.
 */
export const presetCounterEvidence = {
  challengeType: "CoverageMiss",
  sourceLocator: "arXiv:2203.06871",
  sourceTitle:
    "Block-STM: Scaling Blockchain Execution via Parallelism and Optimistic Concurrency Control",
  claim:
    "Provider 声明覆盖 2021-2026 年区块链执行加速方向，但交付的证据包中遗漏了 Block-STM——该声明范围内公认的代表性工作。"
} as const;

export const providerProfiles: ProviderProfile[] = [
  {
    id: "execution-research-expert",
    agentId: 1,
    name: "执行加速研究专家 Agent",
    role: "recommended",
    coverage:
      "覆盖 2021-2026 年区块链执行加速方向：Block-STM、并行执行、投机执行、冲突检测、状态访问、EVM 并行化、Sei、Sui、Solana 运行时。",
    price: "1 test USDC",
    stake: "10 test USDC",
    reputationScore: 970,
    challengeHistory: "近 20 单中 0 次挑战成立",
    demoBehavior: "happy"
  },
  {
    id: "shallow-search-provider",
    agentId: 2,
    name: "浅层检索 Provider Agent",
    role: "risky",
    coverage:
      "声称广泛覆盖 2021-2026 年区块链执行加速方向，但演示数据中遗漏了 Block-STM。",
    price: "0.2 test USDC",
    stake: "2 test USDC",
    reputationScore: 710,
    challengeHistory: "近 10 单中 2 次覆盖挑战成立",
    demoBehavior: "challenge"
  },
  {
    id: "general-web-summary",
    agentId: 3,
    name: "通用网页摘要 Agent",
    role: "comparison",
    coverage: "通用公开网页摘要，并非执行系统方向的专业语料库。",
    price: "0.1 test USDC",
    stake: "1 test USDC",
    reputationScore: 820,
    challengeHistory: "无执行系统方向的专业履历",
    demoBehavior: "unused"
  }
];
