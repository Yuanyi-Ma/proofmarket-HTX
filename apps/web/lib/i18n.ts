import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@proofmarket/shared/src/locale";

export type { Locale };

export const LOCALE_COOKIE = "proofmarket_locale";

export function labelForLocale(locale: Locale): string {
  return normalizeLocale(locale) === "zh" ? "中文" : "EN";
}

export function nextLocale(locale: Locale): Locale {
  return normalizeLocale(locale) === "zh" ? "en" : "zh";
}

export function documentLang(locale: Locale): string {
  return normalizeLocale(locale) === "zh" ? "zh-CN" : "en";
}

export const uiText = {
  en: {
    common: {
      languageSwitch: "中文",
      online: "Online",
      recommended: "Recommended",
      localSimulation: "Local simulation",
      injectiveTestnet: "Injective Testnet",
      viewOnInjective: "View on Injective Explorer",
      noRecords: "No audit records yet",
      expand: "Expand",
      collapse: "Collapse",
      errorPrefix: "Request failed:",
      currentStepAria: "Current step",
      backToCurrentStep: "Back to current step",
      minutes: "minutes",
      unconfirmed: "Unconfirmed",
      pending: "In progress",
      failed: "Failed",
      confirmed: "Confirmed",
      waitingBroadcast: "Waiting for broadcast",
      txFailed: "Transaction failed",
      running: "In progress..."
    },
    nav: {
      site: "Site navigation",
      providers: "Providers and Sources",
      how: "How It Works",
      system: "System Status",
      console: "Open Console",
      footer: "Footer navigation",
      docs: "Docs",
      github: "GitHub"
    },
    landing: {
      subtitle:
        "Trusted Professional Evidence Network for AI Agents. An Agent can commission a Provider with authorized database access and professional research capability, then buy an Evidence Service Package that is source-located, spot-checkable, challengeable, and settleable. Injective carries escrowed payments, delivery commitments, challenge verdicts, refunds, slashing, and reputation records.",
      primary: "Start Commission",
      secondary: "View System Status",
      process:
        "Core flow: compare Provider reputation, authorize within explicit boundaries, verify evidence before acceptance, and challenge faulty delivery.",
      paramsKicker: "Protocol Parameters · Injective Testnet",
      bond: "Provider performance bond",
      challengeDeposit: "Challenge deposit / jury fee",
      defaultSlash: "Default slash",
      defaultSlashValue: "50% of the performance bond; half rewards the challenger",
      windows: "Challenge / defense window",
      windowValue: "5 minutes / 2 minutes",
      juryPool: "Jury pool",
      juryPoolValue: "Nine candidate jurors · three-seat majority for this case",
      statsAria: "Platform metrics",
      stats: [
        "Registered Providers",
        "Completed commissions",
        "Escrow settlement volume (USDC)",
        "Challenges opened / upheld",
        "Average delivery time",
        "Juror seats"
      ],
      providersTitle: "Providers and Evidence Sources",
      providersSub:
        "Each Provider has different authoritative database access, evidence coverage, and domain specialization. On-chain identity and performance bonds create accountability; reputation and challenge history come from chain history. Capability descriptions are Provider-declared.",
      evidenceAbility: "Evidence capability and sources",
      price: "Quote",
      reputation: "Reputation",
      challengeRecord: "Challenge record",
      onchainIdentity: "On-chain identity",
      status: "Status",
      providerColumn: "Provider",
      footerBuilt: "Built with Injective",
      noChallenges: "None",
      challengesUpheld: (challenged: number, upheld: number) => `${challenged} / upheld ${upheld}`,
      displayProviders: [
        {
          name: "Industry Research Evidence Agent",
          specialty:
            "Subscribes to Gartner, IDC, Statista, and Messari Pro; each package includes report title and page locator."
        },
        {
          name: "Financial Data Evidence Agent",
          specialty:
            "Holds Bloomberg and Wind access for macro, market, and crypto-asset data; each item includes metric definition, field, and snapshot time."
        }
      ],
      howTitle: "How It Works",
      howSub:
        "The main path is an Agent service commission: pick a Provider, set a budget, fund escrow, and receive an Evidence Service Package. On-chain receipts and challenges surface only when trust needs to be evaluated; the primary workflow stays focused on purchase, delivery, verification, and settlement.",
      steps: [
        {
          title: "Ask the research question",
          body: "Describe the professional question and budget limit. ProofMarket returns a procurement plan before funds move."
        },
        {
          title: "Choose a Provider",
          body: "Compare Providers by evidence-source coverage, price, on-chain reputation, and challenge record."
        },
        {
          title: "Authorize and commission",
          body: "The Policy Signer only signs actions inside the explicit boundary. Funds enter escrow before Provider delivery."
        },
        {
          title: "Read, accept, or challenge",
          body: "Receive conclusions, source locators, and bounded excerpts first. If the package violates its commitments, use the challenge path for refund and slashing."
        }
      ]
    },
    steps: {
      stepperAria: "Workflow steps",
      labels: ["Ask", "Procurement Plan", "Payment Authorization", "Purchase Execution", "Verify Evidence", "Settlement"],
      reviewing: (displayStep: number, currentStep: number) =>
        `Reviewing step ${displayStep} read-only. Current flow is at step ${currentStep}.`,
      devTitle: (title: string) => `${title} (in development)`,
      devSubtitle: "This step's interface is still in development; backend flow is unaffected.",
      devBody: (no: number, title: string) => `Step ${no} · ${title} (in development)`
    },
    step1: {
      title: "Ask Your Research Question",
      subtitle:
        "Describe the question that needs Provider support and set a budget limit. Your Agent will commission a Provider within the budget and receive a verifiable Evidence Service Package.",
      primary: "Generate Procurement Plan",
      question: "Research question",
      budget: "Budget limit",
      assetHint: "Payment asset: Injective native asset / USDC; equivalent test assets may be used in the demo environment.",
      readonly: "This question has been submitted. This is a read-only review.",
      hint:
        "After submission, your Agent first returns a procurement plan: which Provider to use, what will be delivered, and how the budget is spent. You confirm before any funds move."
    },
    step2: {
      title: "Choose Provider",
      subtitle:
        "Make the procurement decision first: what to buy, who to buy from, and expected cost. Trust records are evidence for Provider selection.",
      primary: "Confirm Plan and Authorize",
      decision: "Purchase decision",
      expected: "Expected deliverable",
      expectedValue:
        "An Evidence Service Package: key conclusions, source locators, bounded excerpts or sample paraphrases, and claims that cannot be concluded; no full source documents are purchased.",
      why: "Why recommended",
      coverageMatch: "Database coverage matches the question:",
      performance: "Comparable history:",
      reputationScore: "reputation score",
      noUpheld: "no upheld challenges.",
      challenged: (challenged: number, upheld: number) => `${challenged} challenges / ${upheld} upheld.`,
      priceInLimit: "Price is inside the authorization cap:",
      expectedPay: "expected payment",
      userCap: "user cap",
      viewRaw: "View original Agent analysis",
      candidates: (count: number) => `Provider candidates (${count}; recommendation selected by default, editable)`,
      candidateHint: "This step estimates who is most likely to deliver verifiable evidence. On-chain reputation and challenges help ranking.",
      price: "Price",
      reputation: "Reputation",
      challengeRecord: "Challenge record",
      onchainIdentity: "On-chain identity",
      noChallengeRecord: "No challenge record",
      viewAddress: (name: string) => `View ${name} address on Injective Explorer`,
      evidenceSources: "Evidence sources",
      changedProvider:
        "You selected a higher-risk Provider. Its evidence coverage and on-chain reputation are weaker priors; if the package has gaps, you can challenge it in step 5.",
      terms: "Purchase Terms",
      deliverable: "Deliverable",
      deliverableValue:
        "Evidence Service Package: conclusion + source locator + bounded excerpt (research reports are paraphrased under subscription terms), with a summary for your question. Full source text never leaves the authorization boundary.",
      acceptance: "Acceptance method",
      acceptanceValue: "Verify source, excerpt, and coverage first; challenge only if a problem is found.",
      budget: "Budget",
      planBudget: "plan budget",
      settlement: "Settlement condition",
      settlementValue:
        "Funds enter on-chain escrow first. After verification, the buyer can accept and settle directly or challenge during the challenge window.",
      protection: "Default protection",
      protectionValue:
        "If delivery violates the commitment, a challenge can trigger a full refund and slash the Provider performance bond.",
      readonly: "The plan has been confirmed. This is a read-only review.",
      empty: "No procurement plan yet. Return to step 1 and submit a research question."
    },
    step3: {
      title: "Confirm Transaction Boundary",
      subtitle: "Confirm which contracts the Agent may call, how much it may spend, and which requests are rejected before signing.",
      primary: "Execute Purchase",
      secondary: "Test Policy Guardrail",
      summaryAria: "Payment authorization summary",
      allowed: "Can do",
      allowedValue: "Create commission, fund escrow, settle, or open a challenge",
      denied: "Cannot do",
      deniedValue: "Direct transfer, call non-allowlisted contracts, or continue after expiry",
      budget: "Funds boundary",
      cap: "authorization cap",
      details: "View full Policy Signer policy",
      policyId: "Policy ID",
      expiry: "Expiry",
      expiryValue: (minutes: number) => `Valid for ${minutes} minutes; automatically expires`,
      totalBudget: "Total budget",
      totalBudgetNote: "actual payout is also constrained by the escrow job budget",
      targets: "Allowed contracts",
      functions: "Allowed functions",
      denyRules: "Deny rules",
      boundaryNote: "These boundaries are enforced by the Policy Signer: in-bound calls are signed; out-of-bound requests are refused.",
      active: "Authorization active",
      guardrailHint: "The guardrail test sends a real out-of-bound transfer request and verifies that the Policy Signer refuses it. No funds move.",
      submitted: "Wait for the Policy Signer policy to activate, then refresh status.",
      checkStatus: "Check approval status",
      executing: "Executing inside the authorized boundary: approve token -> create job -> set budget -> fund escrow. Slow testnet confirmations will appear in step 4.",
      unknown: (status: string) => `Policy has not been submitted or status is unknown. Current status: ${status}`,
      denialAria: "Policy denial record",
      denialTitle: "Out-of-bound action rejected by the Policy Signer",
      rejectCode: "Reject code",
      rejectReason: "Reject reason",
      attempted: "Attempted action",
      rawReturn: "View raw Policy Signer response",
      guardrailOk: "Guardrail active: this request was fully blocked before signing, with zero on-chain funds moved.",
      stillActive: "The policy remains active; you can continue the purchase.",
      missing: "No policy yet. Confirm the procurement plan in step 2 and submit authorization first."
    },
    step4: {
      title: "Purchase Execution",
      subtitle: "The Provider order is executing. Wait for the Evidence Service Package; expand each testnet transaction when verification matters.",
      primary: "Get Evidence Package",
      localDone: "Local simulation: purchase execution is complete, with no testnet transaction details.",
      waiting: "Waiting for purchase execution to finish...",
      confirming: "Purchase execution is confirming. Once complete, the package can be retrieved.",
      txLabels: {
        approve: "Approve token",
        createJob: "Create Provider job",
        setBudget: "Set budget",
        fund: "Fund escrow",
        submit: "Submit package",
        complete: "Settle payment",
        approveDeposit: "Approve deposit + jury fee",
        openChallenge: "Open challenge",
        defense: "Submit defense",
        castVote: "Jury vote",
        resolve: "Execute verdict",
        feedback: "On-chain reputation feedback"
      }
    },
    step5: {
      title: "Verify Evidence",
      subtitle: "Review the Provider's Evidence Service Package, run spot checks, and either accept it or open a challenge.",
      status: {
        Verified: "Verified",
        Challenged: "Challenge in progress",
        ChallengeWon: "Challenge upheld",
        ChallengeLost: "Challenge rejected",
        RefundedOrSlashed: "Verdict executed",
        default: "Waiting for verification"
      },
      verify: "Verify Evidence",
      challenge: "Open Challenge",
      buildChallenge: "Build Challenge Package and Open Challenge",
      packageSummary: "Package summary",
      provider: "Provider",
      coverage: "Coverage Statement",
      packageHash: "Package hash",
      conclusion: "Conclusion",
      sourceLine: "Source support",
      caveat: "What this cannot prove",
      evidenceItems: "Evidence items",
      expertConclusion: "Provider conclusion",
      sourceLocator: "Source locator",
      sourceLibrary: "Source library",
      yearType: "Year / type",
      excerpt: "Excerpt / paraphrase",
      relevance: "Relevance",
      emptyHeadline: "Provider returned no readable conclusion.",
      emptySource: "No source items.",
      emptyCaveat: "Cannot settle without source support.",
      sourceItems: (count: number) => `${count} source item${count === 1 ? "" : "s"}`,
      sourceCount: (count: number, title: string) => `${count} source item${count === 1 ? "" : "s"}; first source: ${title}.`,
      defaultCaveat: "This package only supports the research judgment within the declared coverage. It does not prove global completeness.",
      spotCheckTitle: "Client Agent Spot Check",
      accuracy: "Source Accuracy · sampled excerpt check",
      completeness: "Coverage Completeness · expected-source sample",
      match: "excerpt matches local archive",
      mismatch: "excerpt contradicts local archive",
      skipped: "local archive does not contain this source; skipped",
      present: "included in the Evidence Service Package",
      missing: "missing from the package and inside the Coverage Statement",
      outOfScope: (kind: string) => `outside the Coverage Statement (${kind} source type was not committed); ignored`,
      failed:
        "Spot check failed:",
      accuracyFail: "Source Accuracy - sampled excerpt contradicts the original;",
      completenessFail: "Coverage Completeness - representative in-scope source is missing.",
      challengeReady:
        "The Agent has prepared a Challenge Package with issue point, counter-evidence original text, and hash; it can be opened in one click.",
      spotCheckNote:
        "Your Agent runs probabilistic spot checks against local authorized databases. It does not perform full re-verification; the point is that any omission or tampering has a meaningful chance of being caught cheaply. Local archives stay inside your authorization boundary.",
      challengePackage: "Challenge Package (materials submitted to jurors)",
      providerDelivery: "Provider delivery",
      challengeType: "Challenge type",
      challengerStatement: "Challenger statement",
      hitCoverage: "Coverage clause hit",
      counterEvidenceSource: "Counter-evidence source",
      counterEvidenceLibrary: "Counter-evidence library",
      counterEvidenceClaim: "Counter-evidence claim (plaintext)",
      counterEvidenceHash: "Counter-evidence hash",
      juryBasis: "Jury assignment basis",
      materialsNote:
        "The plaintext above is what jurors receive. Its hash is on-chain, so it cannot be altered later. Jurors use their own source access to retrieve and check the original text.",
      defenseTitle: "Provider Defense Statement (submitted during defense window)",
      defenseStatement: "Defense statement (plaintext)",
      defenseHash: "Defense statement hash",
      viewDefenseTx: "View defense submission transaction on Injective Explorer",
      defenseNote:
        "A challenge is a public on-chain event. The Provider listener submits a defense during the window. Jurors must wait until the defense window ends before voting; a missed defense is treated as waived.",
      defenseScopeNote:
        "This defense only argues scope. If the package had included the missing paper, the Provider could show the committed item and defeat the challenge. It does not do so here.",
      defenseMissing: "Provider did not submit a Defense Statement during the window; defense is treated as waived.",
      juror: (index: number) => `Juror ${index + 1}`,
      originalCheck: "Original-text check",
      inScope: "In scope?",
      hitsDeclared: "Hits declared query?",
      notReturned: "Not returned and not excluded?",
      verdictConclusion: "Conclusion",
      reasonHash: "Reason-book hash",
      voteTx: "Vote transaction",
      viewVoteTx: (id: string) => `View ${id} vote transaction on Injective Explorer`,
      stageOpened: "Challenge opened",
      inScopeMiss: "in-scope coverage miss",
      deposit: "Challenge deposit D",
      depositValue: "2 USDC locked; forfeited to treasury if challenge fails",
      juryFee: "Jury fee F",
      juryFeeValue: "0.5 USDC locked; split by jurors and refunded to challenger if challenge succeeds",
      escrowOrder: "Escrow job",
      frozen: "Frozen pending verdict",
      chainTx: "On-chain transactions",
      requestVerdict: "Request Jury Verdict",
      verdictBusy: "Jury verdict in progress (waiting for defense window + three on-chain votes)...",
      juryResult: (fault: number, dissent: number) => `Jury vote ${fault} : ${dissent} - ProviderFault (in-scope coverage miss, challenge upheld)`,
      juryResultNote:
        "Three independent jurors retrieved original text and voted with reason-book hashes on-chain. Majority rules, and dissent is preserved.",
      jurorCommitmentNote:
        "Each juror registered a model-version hash and procedure hash on-chain; anyone can rerun any vote offline using the committed parameters.",
      executeVerdict: "Execute Verdict (majority reached, anyone can execute)",
      executingVerdict: "Executing verdict...",
      resolved: "Verdict executed",
      fundActions: [
        "Slash 50% of the Provider performance bond for this job (5 USDC); half rewards the challenger",
        "Refund escrowed funds to the buyer",
        "Return challenger deposit + jury fee in full",
        "Pay the 0.5 USDC jury fee from the slash, split across three jurors; remainder goes to treasury"
      ],
      resolvedTx: "Resolution transaction",
      viewResolveTx: "View verdict transaction on Injective Explorer",
      completed: "Challenge flow complete. The faulty Provider cannot receive payment for this job, and the result is recorded in reputation.",
      waitingPackage: "Waiting for Provider delivery.",
      challengeWindow: "Challenge window remaining",
      challengeWindowClosed: "Challenge window closed",
      challengeWindowNote: "If you object to the Evidence Service Package, open a challenge before settlement.",
      hashCheck: "On-chain commitment",
      hashCheckValue: "The received Evidence Service Package matches the Provider-signed on-chain package hash.",
      hashCheckMismatch: "The received Evidence Service Package does not match the on-chain signed commitment."
    },
    step6: {
      title: "Settlement",
      verifiedSubtitle: "Verification passed. You may still challenge; if you choose not to challenge, settle now and rate the service.",
      settledSubtitle: "The Evidence Service Package has been accepted and payment settled. The final answer is shown by default; receipts stay available for review.",
      settleNow: "Settle Now",
      confirmSettle: "Confirm Settlement",
      newTask: "Start New Task",
      audit: "View Full Audit",
      windowOpen: (remaining: string) => `Evidence package verified. Challenge window remaining ${remaining}; you may return to step 5 to challenge or settle now.`,
      windowClosed: "Evidence package verified and the challenge window is closed. Confirm settlement on-chain.",
      finalAnswer: "Final Answer",
      mainFinding: "Main finding",
      sourceSummary: "Source summary",
      cannotConclude: "Cannot conclude",
      emptyConclusion: "The Evidence Service Package is empty; no conclusion can be drawn.",
      emptyEvidence: "No source items.",
      emptyCannot: "No conclusion can be drawn without source support.",
      sourceSummaryOne: (titles: string) => `1 source item: ${titles}`,
      sourceSummaryMany: (count: number, titles: string) => `${count} source items, including: ${titles}${count > 3 ? " and others" : ""}.`,
      defaultCannot:
        "The package cannot prove global completeness, universal acceleration, or that every workload benefits from parallel execution.",
      rating: "Service rating",
      review: "Job review",
      facts: [
        "Verification passed: excerpts, source locators, and coverage align",
        "No challenge was opened during the challenge window",
        "Settled within budget, with no overspend"
      ],
      overall: "Overall rating",
      rated: "Rated and recorded in Provider on-chain reputation",
      viewFeedback: "View reputation feedback transaction",
      ratingAria: "Choose rating (1-5)",
      points: (n: number) => `${n} points`,
      submitRating: "Submit Rating",
      ratingBusy: "Publishing rating...",
      ratingNote:
        "The rating is written as reputation feedback in the on-chain registry and becomes part of the next buyer's Provider reputation view. The Provider cannot edit it.",
      receipts: "Transactions and Receipts",
      jobId: "Job ID",
      policyId: "Policy ID",
      packageHash: "Package hash",
      verdictHash: "Verdict hash",
      tx: (label: string) => `Transaction: ${label}`
    },
    audit: {
      title: "Audit Log",
      sidebarAria: "Audit log",
      denialSummary: "Policy Signer denial record - request blocked before signing, zero funds moved",
      blockedAction: "Blocked action",
      fullRecord: "View full record",
      sourceLabels: {
        user: "User",
        "research-agent": "Research Agent",
        provider: "Provider",
        verifier: "Verifier",
        "policy-signer": "Policy Signer",
        chain: "Chain",
        settlement: "Settlement"
      }
    },
    system: {
      title: "System Status",
      subtitle: "Current deployment overview: contracts, escrow funds, Providers, and jury pool on Injective Testnet.",
      readiness: "Readiness Check",
      checks: {
        contracts: "Escrow, challenge manager, and settlement token contracts are deployed and reachable",
        jury: (current: string, required: string) => `Jury pool ready: ${current}/${required} independent operators registered, with model-version and procedure hashes committed on-chain`,
        stake: (free: string, min: string, total: string, locked: string) => `Provider performance bond ready: free bond ${free} >= minimum ${min} (total ${total}, locked ${locked})`,
        signer: (balance: string) => `Policy Signer address holds budget asset: ${balance}`
      },
      contracts: "Contracts and Protocol Parameters (read from Injective)",
      escrow: "Escrow contract",
      challengeManager: "Challenge manager",
      token: "Injective USDC",
      juryPool: (current: string, required: string) => `Jury Pool (nine-seat candidate pool; ${current}/${required} seats vote in this case)`,
      juror: (index: number) => `Juror ${index + 1}`,
      registered: "Registered",
      unregistered: "Not registered",
      address: "On-chain address",
      modelCommitment: "Model version commitment",
      procedureCommitment: "Jury procedure commitment",
      verificationCapability: "Verification capability",
      capabilityNote: "used for original-text checks and challenge assignment",
      juryNote:
        "Each juror commits model version and jury procedure hashes on-chain. Challenges assign seats by counter-evidence type and source-access capability; each vote must independently retrieve the original text.",
      providers: "Providers (ProofMarket identity + Injective reputation)",
      reputation: "reputation",
      challenged: (challenged: number, upheld: number) => `${challenged} challenges / ${upheld} upheld`,
      onchain: "on-chain",
      executionAddress: "Provider execution address",
      executionAddressNote: (stake: string, min: string) => `shared signing address: performance bond ${stake}, ${min} locked per job`,
      backHome: "Back to home",
      openConsole: "Open console"
    }
  },
  zh: {
    common: {
      languageSwitch: "EN",
      online: "在线",
      recommended: "推荐",
      localSimulation: "本地模拟",
      injectiveTestnet: "Injective 测试网",
      viewOnInjective: "在 Injective Explorer 查看",
      noRecords: "尚无审计记录",
      expand: "展开",
      collapse: "收起",
      errorPrefix: "请求出错：",
      currentStepAria: "当前步骤",
      backToCurrentStep: "回到当前步骤",
      minutes: "分钟",
      unconfirmed: "未确认",
      pending: "进行中",
      failed: "失败",
      confirmed: "已确认",
      waitingBroadcast: "等待广播",
      txFailed: "交易失败",
      running: "进行中…"
    },
    nav: {
      site: "站点导航",
      providers: "Provider 与证据来源",
      how: "工作原理",
      system: "系统状态",
      console: "进入控制台",
      footer: "页脚导航",
      docs: "文档",
      github: "GitHub"
    },
    landing: {
      subtitle:
        "面向 AI Agent 的可信专业证据网络。Agent 可以委托具备授权数据库访问与专业研究能力的 Provider，购买可定位来源、可抽查、可挑战、可结算的证据服务包。Injective 承载托管付款、交付承诺、挑战裁决、退款、罚没与信誉记录。",
      primary: "开始委托",
      secondary: "查看系统状态",
      process:
        "核心流程：比较 Provider 信誉，按明确边界授权，验收前核验证据，对错误交付发起挑战。",
      paramsKicker: "协议参数 · Injective 测试网",
      bond: "Provider 履约保证金",
      challengeDeposit: "挑战押金 / 陪审费",
      defaultSlash: "默认罚没",
      defaultSlashValue: "履约保证金的 50%；其中一半奖励挑战者",
      windows: "挑战 / 应辩窗口",
      windowValue: "5 分钟 / 2 分钟",
      juryPool: "陪审池",
      juryPoolValue: "9 位候选陪审方 · 本案 3 席多数决",
      statsAria: "平台指标",
      stats: [
        "已注册 Provider",
        "已完成委托",
        "托管结算额（USDC）",
        "已发起 / 成立挑战",
        "平均交付时间",
        "陪审席位"
      ],
      providersTitle: "Provider 与证据来源",
      providersSub:
        "不同 Provider 拥有不同的权威数据库访问、证据覆盖与领域专长。链上身份与履约保证金提供问责基础；信誉和挑战历史来自链上记录。能力描述由 Provider 自报。",
      evidenceAbility: "证据能力与来源",
      price: "报价",
      reputation: "信誉",
      challengeRecord: "挑战记录",
      onchainIdentity: "链上身份",
      status: "状态",
      providerColumn: "Provider",
      footerBuilt: "由 Injective 支撑",
      noChallenges: "无",
      challengesUpheld: (challenged: number, upheld: number) => `${challenged} 次 / 成立 ${upheld} 次`,
      displayProviders: [
        {
          name: "行业研究证据 Agent",
          specialty:
            "订阅 Gartner、IDC、Statista 与 Messari Pro；每个证据包包含报告标题与页码定位。"
        },
        {
          name: "金融数据证据 Agent",
          specialty:
            "持有 Bloomberg 与 Wind 访问权限，覆盖宏观、市场与加密资产数据；每条证据包含指标定义、字段与快照时间。"
        }
      ],
      howTitle: "工作原理",
      howSub:
        "主路径是一笔 Agent 服务委托：选择 Provider、设定预算、注资托管，并收到证据服务包。链上凭证与挑战只在需要评估信任时浮现；主工作流聚焦购买、交付、核验与结算。",
      steps: [
        {
          title: "提出研究问题",
          body: "描述专业问题与预算上限。资金移动前，ProofMarket 先返回采购方案。"
        },
        {
          title: "选择 Provider",
          body: "按证据来源覆盖、价格、链上信誉与挑战记录比较 Provider。"
        },
        {
          title: "授权并委托",
          body: "策略签名器只会签署授权边界内的操作。Provider 交付前，资金先进入托管。"
        },
        {
          title: "阅读、验收或挑战",
          body: "先收到结论、来源定位与有限摘录。若证据包违反承诺，可走挑战路径退款并罚没。"
        }
      ]
    },
    steps: {
      stepperAria: "工作流步骤",
      labels: ["提问", "采购方案", "支付授权", "采购执行", "证据核验", "结算"],
      reviewing: (displayStep: number, currentStep: number) =>
        `正在只读查看第 ${displayStep} 步。当前流程位于第 ${currentStep} 步。`,
      devTitle: (title: string) => `${title}（开发中）`,
      devSubtitle: "该步骤界面仍在开发中；后端流程不受影响。",
      devBody: (no: number, title: string) => `第 ${no} 步 · ${title}（开发中）`
    },
    step1: {
      title: "提出你的研究问题",
      subtitle:
        "描述需要 Provider 支持的问题并设定预算上限。你的 Agent 会在预算内委托 Provider，并收到可验证的证据服务包。",
      primary: "生成采购方案",
      question: "研究问题",
      budget: "预算上限",
      assetHint: "支付资产：Injective 原生资产 / USDC；演示环境可能使用等价测试资产。",
      readonly: "该问题已提交。这里是只读回看。",
      hint:
        "提交后，你的 Agent 会先返回采购方案：选哪个 Provider、交付什么、预算如何花费。你确认后资金才会移动。"
    },
    step2: {
      title: "选择 Provider",
      subtitle:
        "先做采购决策：买什么、向谁买、预计花多少钱。信任记录是选择 Provider 的证据。",
      primary: "确认方案，去授权",
      decision: "购买决策",
      expected: "预期交付",
      expectedValue:
        "证据服务包：关键结论、来源定位、有限摘录或样例改写，以及无法得出的结论；不购买完整源文档。",
      why: "推荐理由",
      coverageMatch: "数据库覆盖匹配问题：",
      performance: "可比履约历史：",
      reputationScore: "信誉分",
      noUpheld: "无成立挑战。",
      challenged: (challenged: number, upheld: number) => `${challenged} 次挑战 / ${upheld} 次成立。`,
      priceInLimit: "价格在授权上限内：",
      expectedPay: "预计支付",
      userCap: "用户上限",
      viewRaw: "查看 Agent 原始分析",
      candidates: (count: number) => `Provider 候选（${count} 个；默认选中推荐项，可修改）`,
      candidateHint: "这一步估计谁最可能交付可验证证据。链上信誉与挑战历史会参与排序。",
      price: "价格",
      reputation: "信誉",
      challengeRecord: "挑战记录",
      onchainIdentity: "链上身份",
      noChallengeRecord: "无挑战记录",
      viewAddress: (name: string) => `在 Injective Explorer 查看 ${name} 地址`,
      evidenceSources: "证据来源",
      changedProvider:
        "你选择了风险更高的 Provider。其证据覆盖与链上信誉先验更弱；如果证据包有缺口，可以在第 5 步发起挑战。",
      terms: "购买条款",
      deliverable: "交付物",
      deliverableValue:
        "证据服务包：结论 + 来源定位 + 有限摘录（研究报告按订阅条款改写），并回答你的问题。完整源文不会离开授权边界。",
      acceptance: "验收方式",
      acceptanceValue: "先核验来源、摘录与覆盖；发现问题时才发起挑战。",
      budget: "预算",
      planBudget: "方案预算",
      settlement: "结算条件",
      settlementValue:
        "资金先进入链上托管。核验后，买方可直接验收结算，也可在挑战窗口内发起挑战。",
      protection: "默认保护",
      protectionValue:
        "如果交付违反承诺，挑战可触发全额退款，并罚没 Provider 履约保证金。",
      readonly: "方案已确认。这里是只读回看。",
      empty: "还没有采购方案。回到第 1 步提交研究问题。"
    },
    step3: {
      title: "确认交易边界",
      subtitle: "确认 Agent 可以调用哪些合约、最多花多少钱，以及哪些请求会在签名前被拒绝。",
      primary: "执行采购",
      secondary: "测试越权防护",
      summaryAria: "支付授权摘要",
      allowed: "允许",
      allowedValue: "创建委托、注资托管、结算，或发起挑战",
      denied: "禁止",
      deniedValue: "直接转账、调用白名单外合约，或过期后继续操作",
      budget: "资金边界",
      cap: "授权上限",
      details: "查看完整策略签名器规则",
      policyId: "策略 ID",
      expiry: "过期时间",
      expiryValue: (minutes: number) => `有效 ${minutes} 分钟；到期自动失效`,
      totalBudget: "总预算",
      totalBudgetNote: "实际支付还受托管订单预算限制",
      targets: "允许合约",
      functions: "允许函数",
      denyRules: "拒绝规则",
      boundaryNote: "这些边界由策略签名器执行：边界内请求会被签署，越界请求会被拒绝。",
      active: "授权已生效",
      guardrailHint: "越权测试会发送一笔真实的越界转账请求，并验证策略签名器拒绝它。不会移动资金。",
      submitted: "等待策略签名器策略激活，然后刷新状态。",
      checkStatus: "检查授权状态",
      executing: "正在授权边界内执行：授权代币 -> 创建订单 -> 设置预算 -> 注资托管。测试网确认较慢时会在第 4 步显示。",
      unknown: (status: string) => `策略尚未提交或状态未知。当前状态：${status}`,
      denialAria: "策略拒绝记录",
      denialTitle: "越界操作已被策略签名器拒绝",
      rejectCode: "拒绝码",
      rejectReason: "拒绝原因",
      attempted: "尝试操作",
      rawReturn: "查看策略签名器原始返回",
      guardrailOk: "防护已生效：该请求在签名前被完全阻断，链上资金移动为零。",
      stillActive: "策略仍然有效；可以继续采购。",
      missing: "还没有策略。请先在第 2 步确认采购方案并提交授权。"
    },
    step4: {
      title: "采购执行",
      subtitle: "Provider 订单正在执行。等待证据服务包；需要核验时可展开每笔测试网交易。",
      primary: "获取证据包",
      localDone: "本地模拟：采购执行已完成，没有测试网交易详情。",
      waiting: "等待采购执行完成…",
      confirming: "采购执行正在确认。完成后即可获取证据包。",
      txLabels: {
        approve: "授权代币",
        createJob: "创建 Provider 订单",
        setBudget: "设置预算",
        fund: "注资托管",
        submit: "提交证据包",
        complete: "结算付款",
        approveDeposit: "授权挑战押金 + 陪审费",
        openChallenge: "发起挑战",
        defense: "提交应辩书",
        castVote: "陪审投票",
        resolve: "执行裁决",
        feedback: "链上信誉反馈"
      }
    },
    step5: {
      title: "核验证据",
      subtitle: "查看 Provider 的证据服务包，运行抽查，然后验收或发起挑战。",
      status: {
        Verified: "已核验",
        Challenged: "挑战进行中",
        ChallengeWon: "挑战成立",
        ChallengeLost: "挑战未成立",
        RefundedOrSlashed: "裁决已执行",
        default: "等待核验"
      },
      verify: "核验证据",
      challenge: "发起挑战",
      buildChallenge: "生成挑战包并发起挑战",
      packageSummary: "证据包摘要",
      provider: "Provider",
      coverage: "覆盖声明",
      packageHash: "证据包哈希",
      conclusion: "结论",
      sourceLine: "来源支撑",
      caveat: "不能证明什么",
      evidenceItems: "证据条目",
      expertConclusion: "Provider 结论",
      sourceLocator: "来源定位",
      sourceLibrary: "来源库",
      yearType: "年份 / 类型",
      excerpt: "摘录 / 改写",
      relevance: "相关性",
      emptyHeadline: "Provider 没有返回可读结论。",
      emptySource: "无来源条目。",
      emptyCaveat: "缺少来源支撑，不能结算。",
      sourceItems: (count: number) => `${count} 条来源`,
      sourceCount: (count: number, title: string) => `${count} 条来源；首条来源：${title}。`,
      defaultCaveat: "该证据包只支持覆盖声明范围内的研究判断，不能证明全局完整性。",
      spotCheckTitle: "买方 Agent 抽查",
      accuracy: "查准 · 抽样摘录比对",
      completeness: "查全 · 预期来源样本",
      match: "摘录与本地存档一致",
      mismatch: "摘录与本地存档矛盾",
      skipped: "本地存档没有该来源；跳过",
      present: "已包含在证据服务包中",
      missing: "缺失，且属于覆盖声明范围",
      outOfScope: (kind: string) => `不在覆盖声明内（未承诺 ${kind} 来源类型）；忽略`,
      failed: "抽查失败：",
      accuracyFail: "查准 - 抽样摘录与原文矛盾；",
      completenessFail: "查全 - 代表性范围内来源缺失。",
      challengeReady: "Agent 已准备好挑战包，包含问题点、反证原文与哈希；可一键发起。",
      spotCheckNote:
        "你的 Agent 会用本地授权数据库做概率抽查。它不是全量复核；重点是让遗漏或篡改有相当概率被低成本发现。本地存档仍留在你的授权边界内。",
      challengePackage: "挑战包（提交给陪审方的材料）",
      providerDelivery: "Provider 交付",
      challengeType: "挑战类型",
      challengerStatement: "挑战者陈述",
      hitCoverage: "命中的覆盖条款",
      counterEvidenceSource: "反证来源",
      counterEvidenceLibrary: "反证资料库",
      counterEvidenceClaim: "反证主张（明文）",
      counterEvidenceHash: "反证哈希",
      juryBasis: "陪审方分配依据",
      materialsNote: "上方明文会交给陪审方。哈希已上链，因此之后不能被篡改。陪审方用自己的来源访问权限调取并核对原文。",
      defenseTitle: "Provider 应辩书（应辩窗口内提交）",
      defenseStatement: "应辩陈述（明文）",
      defenseHash: "应辩书哈希",
      viewDefenseTx: "在 Injective Explorer 查看应辩提交交易",
      defenseNote: "挑战是公开链上事件。Provider 监听器会在窗口内提交应辩。陪审方必须等应辩窗口结束后再投票；未应辩视为放弃。",
      defenseScopeNote: "该应辩只讨论范围。如果证据包已包含缺失论文，Provider 可以展示已承诺条目来驳回挑战；这里没有做到。",
      defenseMissing: "Provider 未在应辩窗口内提交应辩书；视为放弃应辩。",
      juror: (index: number) => `陪审方 ${index + 1}`,
      originalCheck: "原文核对",
      inScope: "是否在范围内？",
      hitsDeclared: "是否命中声明检索范围？",
      notReturned: "是否未返回且未排除？",
      verdictConclusion: "结论",
      reasonHash: "理由书哈希",
      voteTx: "投票交易",
      viewVoteTx: (id: string) => `在 Injective Explorer 查看 ${id} 投票交易`,
      stageOpened: "挑战已发起",
      inScopeMiss: "范围内覆盖缺失",
      deposit: "挑战押金 D",
      depositValue: "锁定 2 USDC；挑战失败则进入金库",
      juryFee: "陪审费 F",
      juryFeeValue: "锁定 0.5 USDC；挑战成立时由陪审方分配并退还给挑战者",
      escrowOrder: "托管订单",
      frozen: "冻结等待裁决",
      chainTx: "链上交易",
      requestVerdict: "请求陪审团裁决",
      verdictBusy: "陪审团裁决进行中（等待应辩窗口 + 三笔链上投票）…",
      juryResult: (fault: number, dissent: number) => `陪审团投票 ${fault} : ${dissent} - ProviderFault（范围内覆盖缺失，挑战成立）`,
      juryResultNote: "三位独立陪审方调取原文，并把理由书哈希随投票上链。多数决生效，少数意见保留。",
      jurorCommitmentNote: "每位陪审方都在链上登记了模型版本哈希与程序哈希；任何人都可以用已承诺参数离线复跑投票。",
      executeVerdict: "执行裁决（多数已达成，任何人可执行）",
      executingVerdict: "正在执行裁决…",
      resolved: "裁决已执行",
      fundActions: [
        "罚没该订单 Provider 履约保证金的 50%（5 USDC）；其中一半奖励挑战者",
        "托管资金退款给买方",
        "挑战者押金 + 陪审费全额退回",
        "从罚没中支付 0.5 USDC 陪审费，三位陪审方均分；余额进入金库"
      ],
      resolvedTx: "裁决交易",
      viewResolveTx: "在 Injective Explorer 查看裁决交易",
      completed: "挑战流程完成。错误交付的 Provider 无法获得该订单付款，结果已计入信誉。",
      waitingPackage: "等待 Provider 交付。",
      challengeWindow: "挑战窗口剩余",
      challengeWindowClosed: "挑战窗口已关闭",
      challengeWindowNote: "如果你反对该证据服务包，请在结算前发起挑战。",
      hashCheck: "链上承诺",
      hashCheckValue: "收到的证据服务包与 Provider 签名上链的包哈希一致。",
      hashCheckMismatch: "收到的证据服务包与链上签名承诺不一致。"
    },
    step6: {
      title: "结算",
      verifiedSubtitle: "核验通过。你仍可挑战；如果选择不挑战，现在结算并评分。",
      settledSubtitle: "证据服务包已验收并完成付款。最终回答默认展示，凭证仍可回看。",
      settleNow: "现在结算",
      confirmSettle: "确认结算",
      newTask: "开始新任务",
      audit: "查看完整审计",
      windowOpen: (remaining: string) => `证据包已核验。挑战窗口剩余 ${remaining}；你可以返回第 5 步挑战，或现在结算。`,
      windowClosed: "证据包已核验，挑战窗口已关闭。请在链上确认结算。",
      finalAnswer: "最终回答",
      mainFinding: "主要发现",
      sourceSummary: "来源摘要",
      cannotConclude: "不能得出",
      emptyConclusion: "证据服务包为空，无法得出结论。",
      emptyEvidence: "无来源条目。",
      emptyCannot: "缺少来源支撑，无法得出结论。",
      sourceSummaryOne: (titles: string) => `1 条来源：${titles}`,
      sourceSummaryMany: (count: number, titles: string) => `${count} 条来源，包括：${titles}${count > 3 ? " 等" : ""}。`,
      defaultCannot: "该证据包不能证明全局完整性、普遍加速，也不能证明每种负载都受益于并行执行。",
      rating: "服务评分",
      review: "订单评价",
      facts: [
        "核验通过：摘录、来源定位与覆盖声明一致",
        "挑战窗口内未发起挑战",
        "在预算内完成结算，无超支"
      ],
      overall: "总体评分",
      rated: "已评分，并计入 Provider 链上信誉",
      viewFeedback: "查看信誉反馈交易",
      ratingAria: "选择评分（1-5）",
      points: (n: number) => `${n} 分`,
      submitRating: "提交评分",
      ratingBusy: "正在发布评分…",
      ratingNote: "评分会作为信誉反馈写入链上注册表，并进入下一位买方看到的 Provider 信誉视图。Provider 不能修改。",
      receipts: "交易与凭证",
      jobId: "订单 ID",
      policyId: "策略 ID",
      packageHash: "证据包哈希",
      verdictHash: "裁决哈希",
      tx: (label: string) => `交易：${label}`
    },
    audit: {
      title: "审计日志",
      sidebarAria: "审计日志",
      denialSummary: "策略签名器拒绝记录 - 请求在签名前被阻断，资金移动为零",
      blockedAction: "被阻断操作",
      fullRecord: "查看完整记录",
      sourceLabels: {
        user: "用户",
        "research-agent": "研究 Agent",
        provider: "Provider",
        verifier: "核验器",
        "policy-signer": "策略签名器",
        chain: "链上",
        settlement: "结算"
      }
    },
    system: {
      title: "系统状态",
      subtitle: "当前部署概览：Injective 测试网上的合约、托管资金、Provider 与陪审池。",
      readiness: "就绪检查",
      checks: {
        contracts: "托管、挑战管理与结算代币合约已部署且可访问",
        jury: (current: string, required: string) => `陪审池就绪：${current}/${required} 位独立操作方已注册，并在链上提交模型版本与程序哈希`,
        stake: (free: string, min: string, total: string, locked: string) => `Provider 履约保证金就绪：可用保证金 ${free} >= 最低要求 ${min}（总额 ${total}，已锁定 ${locked}）`,
        signer: (balance: string) => `策略签名器地址持有预算资产：${balance}`
      },
      contracts: "合约与协议参数（从 Injective 读取）",
      escrow: "托管合约",
      challengeManager: "挑战管理合约",
      token: "Injective USDC",
      juryPool: (current: string, required: string) => `陪审池（9 席候选池；本案 ${current}/${required} 席投票）`,
      juror: (index: number) => `陪审方 ${index + 1}`,
      registered: "已注册",
      unregistered: "未注册",
      address: "链上地址",
      modelCommitment: "模型版本承诺",
      procedureCommitment: "陪审程序承诺",
      verificationCapability: "核验能力",
      capabilityNote: "用于原文核对与挑战分配",
      juryNote:
        "每位陪审方都在链上提交模型版本和陪审程序哈希。挑战会按反证类型与来源访问能力分配席位；每次投票都必须独立调取原文。",
      providers: "Provider（ProofMarket 身份 + Injective 信誉）",
      reputation: "信誉",
      challenged: (challenged: number, upheld: number) => `${challenged} 次挑战 / ${upheld} 次成立`,
      onchain: "链上",
      executionAddress: "Provider 执行地址",
      executionAddressNote: (stake: string, min: string) => `共享签名地址：履约保证金 ${stake}，每单锁定 ${min}`,
      backHome: "返回首页",
      openConsole: "打开控制台"
    }
  }
} as const;

export type UiText = typeof uiText.en;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function mergeText<T>(base: T, override: unknown): T {
  if (!isPlainRecord(base) || !isPlainRecord(override)) {
    return (override ?? base) as T;
  }
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = (base as Record<string, unknown>)[key];
    merged[key] = isPlainRecord(baseValue) && isPlainRecord(value)
      ? mergeText(baseValue, value)
      : value;
  }
  return merged as T;
}

export function getUiText(locale: Locale = DEFAULT_LOCALE): UiText {
  if (normalizeLocale(locale) === "zh") {
    return mergeText(uiText.en, uiText.zh);
  }
  return uiText.en;
}
