export const SEPOLIA_CHAIN_ID = 11155111;
export const ALLOWED_CHAIN_ACTIONS = [
  "createJob",
  "fund",
  "submitEvidenceHash",
  "complete"
] as const;
export type ChainAction = (typeof ALLOWED_CHAIN_ACTIONS)[number];

export type DeploymentArtifact = {
  chainId: number;
  network: string;
  deployer: string;
  blockNumber: number;
  coboWallet: string;
  contracts: { MockUSDC: string; ProofMarketEscrow: string };
  mint: { to: string; rawAmount: string; txHash: string };
  deployedAt: string;
};

export type ResearchPlanOutput = {
  taskId: string;
  recommendedProviderId: string;
  reason: string;
  maxPayment: string;
  requiredEvidenceSchema: { minItems: number; requiredFields: string[] };
  chainActions: ChainAction[];
};

export type TxRecord = {
  label: "approve" | "createJob" | "setBudget" | "fund" | "submit" | "complete";
  coboTxId: string | null;
  txHash: string;
  status: "pending" | "confirmed" | "failed";
};

export type CoboDenialRecord = {
  denied: true;
  exitCode: number;
  attemptedAction: string;
  rawOutput: string;
};

function isHexAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function parseDeploymentArtifact(input: unknown): DeploymentArtifact {
  const a = input as DeploymentArtifact;
  if (!a || typeof a !== "object") throw new Error("artifact must be an object");
  if (a.chainId !== SEPOLIA_CHAIN_ID) {
    throw new Error(`artifact chainId must be ${SEPOLIA_CHAIN_ID}, got ${a.chainId}`);
  }
  for (const [name, addr] of [
    ["deployer", a.deployer],
    ["coboWallet", a.coboWallet],
    ["contracts.MockUSDC", a.contracts?.MockUSDC],
    ["contracts.ProofMarketEscrow", a.contracts?.ProofMarketEscrow]
  ] as const) {
    if (!isHexAddress(addr)) throw new Error(`artifact ${name} is not a valid address`);
  }
  return a;
}

const ADDRESS_PATTERN = /0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/;

export function validateResearchPlanOutput(
  input: unknown,
  context: { taskId: string; budgetAmount: string; providerIds: string[] }
): ResearchPlanOutput {
  const p = input as ResearchPlanOutput;
  if (!p || typeof p !== "object") throw new Error("plan must be an object");
  if (p.taskId !== context.taskId) throw new Error("plan taskId mismatch");
  if (!context.providerIds.includes(p.recommendedProviderId)) {
    throw new Error(`unknown provider: ${p.recommendedProviderId}`);
  }
  if (typeof p.reason !== "string" || p.reason.length === 0) {
    throw new Error("plan reason required");
  }
  const payment = Number(p.maxPayment);
  if (!Number.isFinite(payment) || payment <= 0) {
    throw new Error(`maxPayment must be a positive finite number, got "${p.maxPayment}"`);
  }
  if (payment > Number(context.budgetAmount)) {
    throw new Error(`maxPayment ${p.maxPayment} exceeds budget ${context.budgetAmount}`);
  }
  if (!Array.isArray(p.chainActions)) {
    throw new Error("chainActions contains a disallowed action");
  }
  if (p.chainActions.length === 0 || !p.chainActions.every((action) =>
    (ALLOWED_CHAIN_ACTIONS as readonly string[]).includes(action)
  )) {
    throw new Error(
      p.chainActions.length === 0
        ? "chainActions must not be empty"
        : "chainActions contains a disallowed action"
    );
  }
  const schema = p.requiredEvidenceSchema;
  if (!schema || typeof schema.minItems !== "number" || !Array.isArray(schema.requiredFields)) {
    throw new Error("requiredEvidenceSchema malformed");
  }
  if (ADDRESS_PATTERN.test(JSON.stringify(p))) {
    throw new Error("plan output must not contain contract addresses");
  }
  return p;
}
