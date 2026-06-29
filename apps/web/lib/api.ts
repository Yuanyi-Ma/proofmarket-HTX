import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createInMemoryStore } from "@proofmarket/backend/src/demoStore";
import { createTaskService } from "@proofmarket/backend/src/taskService";
import { createRealTaskService } from "@proofmarket/backend/src/realTaskService";
import { createAuditFileLog } from "@proofmarket/backend/src/auditFileLog";
import {
  ALLOWED_CHAIN_ACTIONS,
  parseDeploymentArtifact,
  type DeploymentArtifact,
  validateResearchPlanOutput
} from "@proofmarket/shared/src/realMode";
import {
  getProofMarketNetworkByChainId,
  getProofMarketNetworkByName
} from "@proofmarket/shared/src/chains";
import { createLocalPolicySignerClient } from "@proofmarket/policy-signer/src/policySignerClient";
import { createChainReader } from "@proofmarket/chain/src/chainReader";
import { createChallengeResolver } from "@proofmarket/chain/src/challengeResolver";
import {
  createReputationClient,
  readReputationSummary,
  reputationSummaryToScore1000
} from "@proofmarket/chain/src/erc8004";
import {
  runClaudeResearchAgent,
  type ResearchContext,
  type ResearchRun
} from "@proofmarket/agents/src/claudeResearchAgent";
import { runCodexResearchAgent } from "@proofmarket/agents/src/codexResearchAgent";

type TaskService = ReturnType<typeof createTaskService>;

const globalForProofMarket = globalThis as typeof globalThis & {
  proofMarketService?: TaskService;
};

function repoRoot(): string {
  // Next dev/build runs with cwd = apps/web
  return join(process.cwd(), "..", "..");
}

function loadDeploymentArtifact(root: string): DeploymentArtifact {
  const explicitPath = process.env.PROOFMARKET_DEPLOYMENT_PATH;
  if (explicitPath) {
    return parseDeploymentArtifact(JSON.parse(readFileSync(explicitPath, "utf8")));
  }

  const requestedNetwork = process.env.PROOFMARKET_NETWORK;
  const candidates = requestedNetwork
    ? [getProofMarketNetworkByName(requestedNetwork).deploymentFile]
    : [
        getProofMarketNetworkByName("injective-testnet").deploymentFile,
        getProofMarketNetworkByName("sepolia").deploymentFile
      ];

  for (const file of candidates) {
    const path = join(root, "deployments", file);
    if (existsSync(path)) {
      return parseDeploymentArtifact(JSON.parse(readFileSync(path, "utf8")));
    }
  }

  throw new Error(
    `No deployment artifact found. Tried: ${candidates.map((file) => `deployments/${file}`).join(", ")}`
  );
}

async function runPresetResearchAgent(context: ResearchContext): Promise<ResearchRun> {
  const recommendedProviderId = context.providerCatalog.some(
    (entry) => entry.providerId === "execution-research-expert"
  )
    ? "execution-research-expert"
    : context.providerCatalog[0]?.providerId;

  if (!recommendedProviderId) {
    throw new Error("provider catalog is empty");
  }

  const preset = validateResearchPlanOutput(
    {
      taskId: context.taskId,
      recommendedProviderId,
      reason:
        "The Blockchain Systems Evidence Agent has the best declared source coverage for this question, the highest on-chain reputation, and the lowest challenge-history risk, making it the best Provider for this job.",
      ranking: context.providerCatalog.map((entry) => {
        if (entry.providerId === recommendedProviderId) {
          return {
            providerId: entry.providerId,
            reason:
              "Declared literature and industry research access covers parallel execution, speculative execution, conflict detection, and production cases; on-chain reputation and challenge history are strongest."
          };
        }
        if (entry.providerId === "shallow-search-provider") {
          return {
            providerId: entry.providerId,
            reason:
              "Lower price, but weaker challenge history and higher prior risk of incomplete delivery; suitable for the challenge-branch demo."
          };
        }
        return {
          providerId: entry.providerId,
          reason:
            "Useful as a comparison candidate, but its database coverage is less specialized for this question than the recommendation."
        };
      }),
      maxPayment: context.budgetAmount,
      requiredEvidenceSchema: {
        minItems: 3,
        requiredFields: [
          "sourceTitle",
          "sourceLocator",
          "claim",
          "relevanceExplanation"
        ]
      },
      chainActions: ALLOWED_CHAIN_ACTIONS
    },
    {
      taskId: context.taskId,
      budgetAmount: context.budgetAmount,
      providerIds: context.providerCatalog.map((entry) => entry.providerId)
    }
  );

  return {
    plan: preset,
    rawStdout: JSON.stringify({
      result: JSON.stringify(preset)
    }),
    attempts: 1,
    agentName: "Preset Research Agent"
  };
}

function buildRealService(): TaskService {
  const root = repoRoot();
  const deployment = loadDeploymentArtifact(root);
  const network = getProofMarketNetworkByChainId(deployment.chainId);
  // No fallback to the deployer: createJob pins the provider address, and the
  // provider service signs submit() with PROVIDER_SIGNER_PRIVATE_KEY — a
  // mismatched identity would make every submit revert.
  const providerAddress = process.env.PROVIDER_SIGNER_ADDRESS;
  if (!providerAddress) {
    throw new Error(
      "PROVIDER_SIGNER_ADDRESS is not set. Real mode requires the provider signer address " +
        "(the account matching PROVIDER_SIGNER_PRIVATE_KEY) in .env — see .env.example."
    );
  }
  const servicesUrl = process.env.SERVICES_URL ?? "http://localhost:4010";
  const rpcUrl = process.env[network.rpcEnvVar] ?? network.defaultRpcUrl;
  const chain = createChainReader(rpcUrl, { chainId: deployment.chainId });
  const policySignerPrivateKey = process.env.POLICY_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!policySignerPrivateKey) {
    throw new Error(
      "POLICY_SIGNER_PRIVATE_KEY is not set. Real mode needs the local policy signer key " +
        "that matches POLICY_SIGNER_WALLET_ADDRESS."
    );
  }
  const policySigner = createLocalPolicySignerClient({
    rpcUrl,
    privateKey: policySignerPrivateKey,
    srcAddress: deployment.policySignerAddress,
    chainId: deployment.chainId
  });

  // resolveChallenge is only needed when a ChallengeManager is deployed AND the
  // resolver key is available.  Neither is required for the success path, so we
  // build a call-time-throwing stub when either is absent instead of failing at
  // startup.
  const resolverKey = process.env.RESOLVER_PRIVATE_KEY;
  const challengeManagerAddress = deployment.contracts.ProofMarketChallengeManager;
  const resolveChallenge =
    challengeManagerAddress && resolverKey
      ? createChallengeResolver({
          rpcUrl,
          chainId: deployment.chainId,
          privateKey: resolverKey as `0x${string}`,
          challengeManagerAddress: challengeManagerAddress as `0x${string}`
        })
      : async (): Promise<{ txHash: string }> => {
          if (!resolverKey) {
            throw new Error(
              "RESOLVER_PRIVATE_KEY not set — required to resolve challenges"
            );
          }
          throw new Error(
            "deployment artifact has no contracts.ProofMarketChallengeManager — " +
              "redeploy with the P0-2 script before resolving challenges"
          );
        };

  // ERC-8004 reputation deps (P1-2). Same lazy/guarded pattern as
  // resolveChallenge: when the artifact has no erc8004 section (or the rater
  // key is absent for writes), build a stub that throws only when called —
  // a missing reputation config must not break startup, and the service
  // treats both deps' failures as non-fatal (plan falls back to fixture
  // scores; feedback failure is audited without failing settlement).
  const erc8004 = deployment.erc8004;
  // Rater = PROVIDER_SIGNER key: the ReputationRegistry rejects self-feedback,
  // and the agent NFTs are owned by the deployer — so the provider signer is a
  // valid (non-owner) rater. Reuses an existing env var; nothing new needed.
  const raterKey = process.env.PROVIDER_SIGNER_PRIVATE_KEY;
  const reputationClient =
    erc8004 && raterKey
      ? createReputationClient({
          rpcUrl,
          privateKey: raterKey as `0x${string}`,
          reputationAddress: erc8004.reputationRegistry as `0x${string}`,
          chainId: deployment.chainId
        })
      : null;
  const publishFeedback = reputationClient
    ? async (input: { agentId: number; value: number; tag2: string }) =>
        reputationClient.giveFeedback({
          agentId: BigInt(input.agentId),
          value: BigInt(input.value),
          valueDecimals: 2,
          tag1: "proofmarket",
          tag2: input.tag2,
          endpoint: "",
          feedbackURI: `proofmarket://feedback/${input.tag2}`
        })
    : async (): Promise<{ txHash: `0x${string}` }> => {
        throw new Error(
          erc8004
            ? "PROVIDER_SIGNER_PRIVATE_KEY not set — required as the ERC-8004 feedback rater"
            : "deployment artifact has no erc8004 section — re-run the P1-1 registration script"
        );
      };
  const readReputation = erc8004
    ? async (agentId: number): Promise<{ score: number }> => {
        const summary = await readReputationSummary(
          rpcUrl,
          erc8004.reputationRegistry as `0x${string}`,
          BigInt(agentId),
          "",
          "",
          undefined,
          deployment.chainId
        );
        if (summary.count === 0n) {
          // No feedback on-chain yet: let the service fall back to the fixture
          // score instead of rendering a misleading 0.
          throw new Error(`agent ${agentId} has no on-chain feedback yet`);
        }
        return { score: reputationSummaryToScore1000(summary) };
      }
    : async (): Promise<{ score: number }> => {
        throw new Error(
          "deployment artifact has no erc8004 section — re-run the P1-1 registration script"
        );
      };

  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${servicesUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`services ${path} failed: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  const planSource = process.env.PROOFMARKET_PLAN_SOURCE ?? "codex";
  const runResearchAgent =
    planSource === "preset"
      ? runPresetResearchAgent
      : planSource === "claude"
        ? (context: ResearchContext) => runClaudeResearchAgent(context)
        : (context: ResearchContext) => runCodexResearchAgent(context, { cwd: root });

  return createRealTaskService(createInMemoryStore(), {
    deployment,
    providerAddress,
    runResearchAgent,
    policySigner,
    chain,
    services: {
      runProvider: (input) => post("/provider/run", input),
      submitDeliverable: (input) => post("/provider/submit", input),
      judgeVerify: (input) => post("/judge/verify", input),
      providerDefend: (input) => post("/provider/defend", input),
      juryVote: (input) => post("/jury/vote", input)
    },
    resolveChallenge,
    publishFeedback,
    readReputation,
    audit: createAuditFileLog(root),
    now: () => new Date().toISOString()
  });
}

export function getTaskService(): TaskService {
  if (!globalForProofMarket.proofMarketService) {
    globalForProofMarket.proofMarketService =
      process.env.PROOFMARKET_MODE === "real"
        ? buildRealService()
        : createTaskService(createInMemoryStore());
  }

  return globalForProofMarket.proofMarketService;
}
