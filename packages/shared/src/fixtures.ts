import type { ProviderProfile } from "./types";

export const defaultQuestion = "请调研近几年区块链交易执行加速的最新研究进展。";

export const providerProfiles: ProviderProfile[] = [
  {
    id: "execution-research-expert",
    agentId: 1,
    name: "Execution Research Expert Agent",
    role: "recommended",
    coverage:
      "2021-2026 blockchain execution acceleration, Block-STM, parallel execution, speculative execution, conflict detection, state access, EVM parallelization, Sei, Sui, Solana runtime.",
    price: "1 test USDC",
    stake: "10 test USDC",
    reputationScore: 970,
    challengeHistory: "0 successful challenges in last 20 jobs",
    demoBehavior: "happy"
  },
  {
    id: "shallow-search-provider",
    agentId: 2,
    name: "Shallow Search Provider Agent",
    role: "risky",
    coverage:
      "Claims broad 2021-2026 blockchain execution acceleration coverage, but demo fixture misses Block-STM.",
    price: "0.2 test USDC",
    stake: "2 test USDC",
    reputationScore: 710,
    challengeHistory: "2 successful coverage challenges in last 10 jobs",
    demoBehavior: "challenge"
  },
  {
    id: "general-web-summary",
    agentId: 3,
    name: "General Web Summary Agent",
    role: "comparison",
    coverage: "General public web summaries, not a specialist execution systems corpus.",
    price: "0.1 test USDC",
    stake: "1 test USDC",
    reputationScore: 820,
    challengeHistory: "No specialist execution-system history",
    demoBehavior: "unused"
  }
];
