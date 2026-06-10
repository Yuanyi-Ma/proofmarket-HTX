export type TaskStatus =
  | "Created"
  | "Planned"
  | "PactSubmitted"
  | "PactActive"
  | "PactRejected"
  | "JobFunded"
  | "DeniedByCobo"
  | "Delivered"
  | "Verified"
  | "Challenged"
  | "ChallengeWon"
  | "ChallengeLost"
  | "RefundedOrSlashed"
  | "Settled"
  | "Audited";

export type AuditSource =
  | "user"
  | "research-agent"
  | "provider"
  | "verifier"
  | "cobo"
  | "chain"
  | "settlement";

export type AuditResult = "success" | "pending" | "denied" | "failed";

export type ProviderId =
  | "execution-research-expert"
  | "shallow-search-provider"
  | "general-web-summary";

export type EvidenceItem = {
  providerAnswer: string;
  sourceTitle: string;
  sourceLocator: string;
  sourceMetadata: {
    year: number;
    type: "paper" | "report" | "chain-data";
  };
  excerptOrSummary: string;
  relevanceExplanation: string;
};

export type ProviderAnswerPackage = {
  taskId: string;
  providerAgentId: number;
  providerId: ProviderId;
  providerName: string;
  coverageStatement: string;
  answers: EvidenceItem[];
  packageHash: string;
};

export type ProviderProfile = {
  id: ProviderId;
  agentId: number;
  name: string;
  role: "recommended" | "risky" | "comparison";
  coverage: string;
  price: string;
  stake: string;
  reputationScore: number;
  challengeHistory: string;
  demoBehavior: "happy" | "challenge" | "unused";
};

export type ProcurementPlan = {
  taskId: string;
  userQuestion: string;
  evidenceNeed: string;
  totalBudget: string;
  perJobCap: string;
  recommendedProviderId: ProviderId;
  providerCount: 3;
  coverage: string;
  returnType: "provider-answer-package";
  verificationMethod: string;
};

export type PactSummary = {
  intent: string;
  totalBudget: string;
  perJobCap: string;
  allowedTargets: string[];
  allowedFunctions: string[];
  denyRules: string[];
  expiresInMinutes: number;
  pactId: string;
  status: "draft" | "submitted" | "active" | "rejected";
};

export type AuditEvent = {
  id: string;
  taskId: string;
  source: AuditSource;
  type: string;
  result: AuditResult;
  message: string;
  txHash: string | null;
  pactId: string | null;
  jobId: number | null;
  createdAt: string;
};

export type ChallengeVote = {
  voterId: string;
  vote: "ProviderFault";
  reasonCode: string;
  reason: string;
  resultHash: string;
};

export type TaskChallenge = {
  type: "CoverageMiss";
  counterEvidenceHash: string;
  /** On-chain challenge id from ChallengeManager.openChallenge (real mode). */
  challengeId?: number | null;
  vote?: ChallengeVote | null;
  /** Settlement tx of ChallengeManager.resolve (real mode). */
  resolvedTxHash?: string | null;
};

export type Task = {
  id: string;
  userQuestion: string;
  status: TaskStatus;
  budgetLimit: string;
  selectedProviderIds: ProviderId[];
  plan: ProcurementPlan | null;
  pact: PactSummary | null;
  providerPackage: ProviderAnswerPackage | null;
  /** Optional for backwards compatibility: absent until a challenge is opened. */
  challenge?: TaskChallenge | null;
  audit: AuditEvent[];
  jobId: number | null;
  mode: "fixture" | "real";
  txRecords: import("./realMode").TxRecord[];
  claudePlanRaw: string | null;
  denial: import("./realMode").CoboDenialRecord | null;
  createdAt: string;
  updatedAt: string;
};
