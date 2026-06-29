import type { ChallengeDefense, JuryVote, ProviderProfile } from "./types";
import { stableHash } from "./hash";
import { presetJurorIdentities } from "./jurors";
import { normalizeLocale, type Locale } from "./locale";

export const defaultQuestion =
  "What are the latest research developments in blockchain transaction execution acceleration?";

export const demoEscrowTxHashes = {
  approve: "0x63cd42bfe64e42534a92184918d5e7a0ad6481b4bb21d640b6dba5d0c27a0dc4",
  createJob: "0xd9dd89583f8a49dbdddc9d93c9ba85731c476c499d4d0440658cbced54bbc4d0",
  setBudget: "0x706d5300379ea5756ad525ed86527be5251006c670b6cf52838b8d953dd0cf4a",
  fund: "0x2ccb3ba060cbaa27cf41fb333f58c46cc04c813a9c5c6fcff329ece662c6329b"
} as const;

export function getDefaultQuestion(locale: Locale = "en"): string {
  return normalizeLocale(locale) === "zh"
    ? "请调研近几年区块链交易执行加速的最新研究进展。"
    : defaultQuestion;
}

const counterEvidenceByLocale = {
  en: {
    challengeType: "CoverageMiss",
    sourceLocator: "doi:10.1145/3572848.3577524",
    sourceTitle:
      "Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing",
    sourceLibrary: "acm-dl",
    claim:
      "The Provider claimed coverage of 2021-2026 blockchain execution-acceleration research, but the delivered Evidence Service Package omitted Block-STM, a representative in-scope work."
  },
  zh: {
    challengeType: "CoverageMiss",
    sourceLocator: "doi:10.1145/3572848.3577524",
    sourceTitle:
      "Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing",
    sourceLibrary: "acm-dl",
    claim:
      "Provider 声明覆盖 2021-2026 年区块链执行加速方向，但交付的证据服务包中遗漏了 Block-STM——该承诺范围内公认的代表性工作。"
  }
} as const;

export function getPresetCounterEvidence(locale: Locale = "en") {
  return counterEvidenceByLocale[normalizeLocale(locale)];
}

export const presetCounterEvidence = getPresetCounterEvidence();

const challengeDocumentByLocale = {
  en: {
    statement:
      "The delivered Evidence Service Package did not include Block-STM (ACM PPoPP '23, doi:10.1145/3572848.3577524), a widely cited representative work on parallel blockchain execution. " +
      "The Provider did not exclude this subtopic from its Coverage Statement, so this is an in-scope CoverageMiss. " +
      "In addition, a Source Accuracy spot check found that item 1, A Survey of Blockchain Performance Optimization Techniques, reversed the original source's conclusion: the archived text attributes gains to execution-layer parallelism, while the package reframed them as consensus and hardware effects.",
    hitCoverageClause:
      "Coverage Statement: broad coverage of 2021-2026 academic literature on blockchain execution acceleration, with IEEE Xplore and ACM Digital Library subscriptions.",
    juryAssignmentBasis:
      "The counter-evidence is in ACM Digital Library, a subscription database. All three registered jurors hold ACM DL and IEEE Xplore access, so each can retrieve the original text independently."
  },
  zh: {
    statement:
      "交付的证据服务包未包含 Block-STM（ACM PPoPP '23，doi:10.1145/3572848.3577524）——区块链并行执行方向被广泛引用的代表性工作，" +
      "且该 Provider 未在承诺范围中排除该子方向，属于承诺范围内漏检（CoverageMiss）。" +
      "另：查准抽检发现证据服务包第 1 条《A Survey of Blockchain Performance Optimization Techniques》的摘录与原文结论相反" +
      "（原文归因执行层并行化，证据服务包改写为共识与硬件主导），作为佐证一并提交陪审员。",
    hitCoverageClause:
      "承诺范围：『广泛覆盖 2021-2026 年区块链执行加速方向的学术论文（持有 IEEE Xplore / ACM Digital Library 订阅）』",
    juryAssignmentBasis:
      "反证位于 ACM Digital Library（订阅库）；三位注册陪审员均持有 ACM DL 与 IEEE Xplore 订阅授权，可独立调取原文，全部入席。"
  }
} as const;

export function getPresetChallengeDocument(locale: Locale = "en") {
  return challengeDocumentByLocale[normalizeLocale(locale)];
}

export const presetChallengeDocument = getPresetChallengeDocument();

function makeDefense(locale: Locale): Omit<ChallengeDefense, "txHash"> {
  const statement =
    normalizeLocale(locale) === "zh"
      ? "检索按声明的关键词字面执行，未触达 Block-STM 一文；该文属并行执行子方向，我方认为不构成对『执行加速』整体声明的漏检。关于综述摘录，系我方对原文的概括性改写，并非引用错误。"
      : "The search followed the declared keywords literally and did not surface Block-STM. We view that paper as part of the parallel-execution subtopic rather than a required item under the broader execution-acceleration claim. The survey excerpt was a summary-level paraphrase, not a citation error.";
  return { statement, defenseHash: stableHash({ defense: statement }) };
}

export function getPresetDefense(locale: Locale = "en"): Omit<ChallengeDefense, "txHash"> {
  return makeDefense(locale);
}

export const presetDefense = getPresetDefense();

export const presetJurors = [
  {
    ...presetJurorIdentities[0],
    libraryAccess: ["ieee-xplore", "acm-dl", "sciencedirect", "arxiv", "springer-link"]
  },
  {
    ...presetJurorIdentities[1],
    libraryAccess: ["ieee-xplore", "acm-dl", "sciencedirect", "usenix"]
  },
  {
    ...presetJurorIdentities[2],
    libraryAccess: ["ieee-xplore", "acm-dl", "sciencedirect", "arxiv", "cnki"]
  }
] as const;

function juryBooks(locale: Locale) {
  if (normalizeLocale(locale) === "zh") {
    return [
      {
        vote: "ProviderFault" as const,
        reasonCode: "COVERAGE_MISS",
        reasonBook: {
          sourceCheck:
            "已凭自有 ACM Digital Library 订阅调取 doi:10.1145/3572848.3577524 原文：该文真实存在，主题为区块链交易乐观并行执行；逐一核对被挑战证据服务包全部条目，均不含该文，缺失属实。",
          inScope:
            "是。Block-STM 直接研究区块链交易并行执行加速，落在声明的『执行加速』范围内。",
          hitsDeclaredQuery:
            "是。『并行执行 / 投机执行』与声明检索词在语义上直接命中。",
          notReturnedNotExcluded:
            "是。交付的证据服务包未含该文，承诺范围也未排除并行执行子方向。",
          conclusion: "原文核对与三问皆成立，构成承诺范围内漏检，判 ProviderFault。"
        }
      },
      {
        vote: "ProviderFault" as const,
        reasonCode: "COVERAGE_MISS",
        reasonBook: {
          sourceCheck:
            "已凭 ACM DL 订阅确认反证原文存在且与挑战包描述一致，证据服务包确未包含；另核对挑战包所附综述摘录问题：原文结论归因执行层并行化，证据服务包摘录确与原文相悖，佐证其检索质量缺陷。",
          inScope: "是。该文为执行加速方向被广泛引用的代表性工作。",
          hitsDeclaredQuery: "是。声明覆盖语句按字面即包含交易执行优化。",
          notReturnedNotExcluded:
            "是。应辩书承认未触达且未事先排除，仅作范围抗辩，不能成立。",
          conclusion: "覆盖缺失成立，判 ProviderFault。"
        }
      },
      {
        vote: "ProviderNotFault" as const,
        reasonCode: "SCOPE_AMBIGUOUS",
        reasonBook: {
          sourceCheck:
            "已凭 ACM DL 订阅调取原文确认其存在、确认证据服务包未包含——事实无分歧，分歧在承诺范围的解释。",
          inScope: "存疑。『执行加速』未逐项列举子方向，对并行执行的涵盖存在解释空间。",
          hitsDeclaredQuery: "部分。字面检索词未直接包含 Block-STM 同义词。",
          notReturnedNotExcluded: "是，未返回亦未排除。",
          conclusion: "三问未全部明确成立，按宽容原则倾向不构成失职，持异议票。"
        }
      }
    ];
  }

  return [
    {
      vote: "ProviderFault" as const,
      reasonCode: "COVERAGE_MISS",
      reasonBook: {
        sourceCheck:
          "Using its own ACM Digital Library subscription, the juror retrieved doi:10.1145/3572848.3577524. The paper exists, concerns optimistic parallel execution for blockchain transactions, and is absent from every item in the challenged package.",
        inScope:
          "Yes. Block-STM directly studies blockchain transaction execution acceleration and falls inside the declared execution-acceleration scope.",
        hitsDeclaredQuery:
          "Yes. Parallel execution and speculative execution are semantic matches for the declared search scope.",
        notReturnedNotExcluded:
          "Yes. The package did not return the paper, and the Coverage Statement did not exclude the parallel-execution subtopic.",
        conclusion: "The original-text check and all three ruling questions pass. This is an in-scope CoverageMiss, so the vote is ProviderFault."
      }
    },
    {
      vote: "ProviderFault" as const,
      reasonCode: "COVERAGE_MISS",
      reasonBook: {
        sourceCheck:
          "ACM DL access confirms the counter-evidence text and confirms the package omitted it. The attached Source Accuracy issue also checks out: the package's survey excerpt contradicts the archived source's execution-layer conclusion.",
        inScope: "Yes. The paper is a representative work in execution acceleration.",
        hitsDeclaredQuery: "Yes. The literal Coverage Statement includes transaction execution optimization.",
        notReturnedNotExcluded:
          "Yes. The defense concedes the search did not reach the paper and offers only a scope objection.",
        conclusion: "The coverage miss is established. The vote is ProviderFault."
      }
    },
    {
      vote: "ProviderNotFault" as const,
      reasonCode: "SCOPE_AMBIGUOUS",
      reasonBook: {
        sourceCheck:
          "ACM DL access confirms the paper exists and is absent from the package. The disagreement is scope interpretation, not the underlying fact.",
        inScope:
          "Ambiguous. The phrase execution acceleration did not enumerate every subtopic, so inclusion of parallel execution leaves room for interpretation.",
        hitsDeclaredQuery:
          "Partial. The literal declared keywords did not include the specific Block-STM term.",
        notReturnedNotExcluded: "Yes. The paper was neither returned nor excluded.",
        conclusion: "Because the three questions are not all unambiguous, the leniency principle favors ProviderNotFault. This is the dissent."
      }
    }
  ];
}

export function presetJuryVotes(
  jurorAddresses: readonly string[],
  locale: Locale = "en"
): JuryVote[] {
  return juryBooks(locale).map((book, i) => {
    const juror = presetJurors[i];
    return {
      jurorId: juror.jurorId,
      jurorAddress: jurorAddresses[i] ?? "",
      modelFamily: juror.modelFamily,
      vote: book.vote,
      reasonCode: book.reasonCode,
      reasonBook: book.reasonBook,
      reasonHash: stableHash({ jurorId: juror.jurorId, ...book.reasonBook })
    };
  });
}

const providerProfilesByLocale: Record<Locale, ProviderProfile[]> = {
  en: [
    {
      id: "execution-research-expert",
      agentId: 1,
      address: "0x0866e2b066d1D04e4a5A4Cccc380E7Da2c1c2f3a",
      name: "Blockchain Systems Evidence Agent",
      role: "recommended",
      coverage:
        "Holds IEEE Xplore, ACM Digital Library, and Elsevier ScienceDirect access, plus Messari Pro and Delphi Digital research subscriptions. Focuses on transaction execution, parallel and speculative execution, and consensus optimization. Each Evidence Service Package includes source library, source locator, and bounded excerpt or paraphrase.",
      libraries: ["ieee-xplore", "acm-dl", "sciencedirect", "messari-pro", "delphi-digital"],
      price: "1 USDC",
      stake: "10 USDC",
      reputationScore: 970,
      challengeStats: { challenged: 0, upheld: 0 },
      demoBehavior: "happy"
    },
    {
      id: "shallow-search-provider",
      agentId: 2,
      address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      name: "Fast Literature Search Agent",
      role: "risky",
      coverage:
        "Claims IEEE Xplore and ACM Digital Library subscriptions, runs fast keyword searches on blockchain performance papers, and offers same-day delivery at a low price.",
      libraries: ["ieee-xplore", "acm-dl"],
      price: "0.2 USDC",
      stake: "2 USDC",
      reputationScore: 620,
      challengeStats: { challenged: 5, upheld: 3 },
      demoBehavior: "challenge"
    },
    {
      id: "general-web-summary",
      agentId: 3,
      address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      name: "Consensus Layer Research Agent",
      role: "comparison",
      coverage:
        "Holds IEEE Xplore access and covers USENIX systems papers. Specializes in consensus and networking topics such as BFT, peer-to-peer propagation, and block production. Execution-layer coverage is limited.",
      libraries: ["ieee-xplore", "usenix"],
      price: "0.1 USDC",
      stake: "1 USDC",
      reputationScore: 800,
      challengeStats: { challenged: 1, upheld: 0 },
      demoBehavior: "unused"
    }
  ],
  zh: [
    {
      id: "execution-research-expert",
      agentId: 1,
      address: "0x0866e2b066d1D04e4a5A4Cccc380E7Da2c1c2f3a",
      name: "区块链系统专家 Agent",
      role: "recommended",
      coverage:
        "持有 IEEE Xplore、ACM Digital Library 与 Elsevier ScienceDirect 论文库授权，订阅 Messari Pro 与 Delphi Digital 行业研报库；专注交易执行、并行/投机执行与共识优化方向，证据服务包逐条附来源库、来源定位与限长摘录。",
      libraries: ["ieee-xplore", "acm-dl", "sciencedirect", "messari-pro", "delphi-digital"],
      price: "1 USDC",
      stake: "10 USDC",
      reputationScore: 970,
      challengeStats: { challenged: 0, upheld: 0 },
      demoBehavior: "happy"
    },
    {
      id: "shallow-search-provider",
      agentId: 2,
      address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      name: "文献速查 Agent",
      role: "risky",
      coverage:
        "持有 IEEE Xplore 与 ACM Digital Library 订阅，按关键词快速检索区块链性能方向论文，当天交付，价格实惠。",
      libraries: ["ieee-xplore", "acm-dl"],
      price: "0.2 USDC",
      stake: "2 USDC",
      reputationScore: 620,
      challengeStats: { challenged: 5, upheld: 3 },
      demoBehavior: "challenge"
    },
    {
      id: "general-web-summary",
      agentId: 3,
      address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      name: "共识层研究专家 Agent",
      role: "comparison",
      coverage:
        "持有 IEEE Xplore 论文库授权并覆盖 USENIX 系统会议论文，专注共识与网络层方向（BFT 共识、P2P 网络、出块与传播）；执行层论文覆盖有限。",
      libraries: ["ieee-xplore", "usenix"],
      price: "0.1 USDC",
      stake: "1 USDC",
      reputationScore: 800,
      challengeStats: { challenged: 1, upheld: 0 },
      demoBehavior: "unused"
    }
  ]
};

export function getProviderProfiles(locale: Locale = "en"): ProviderProfile[] {
  return providerProfilesByLocale[normalizeLocale(locale)];
}

export const providerProfiles: ProviderProfile[] = getProviderProfiles();
