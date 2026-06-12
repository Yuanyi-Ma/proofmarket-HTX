import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createInMemoryStore } from "@proofmarket/backend/src/demoStore";
import { createTaskService } from "@proofmarket/backend/src/taskService";
import { createRealTaskService } from "@proofmarket/backend/src/realTaskService";
import { createAuditFileLog } from "@proofmarket/backend/src/auditFileLog";
import {
  ALLOWED_CHAIN_ACTIONS,
  parseDeploymentArtifact,
  validateResearchPlanOutput
} from "@proofmarket/shared/src/realMode";
import { createCliCoboClient } from "@proofmarket/cobo/src/coboClient";
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

type TaskService = ReturnType<typeof createTaskService>;

const globalForProofMarket = globalThis as typeof globalThis & {
  proofMarketService?: TaskService;
};

function repoRoot(): string {
  // Next dev/build runs with cwd = apps/web
  return join(process.cwd(), "..", "..");
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
        "区块链系统专家 Agent 的自报资料覆盖与本问题最匹配，同时链上信誉最高、历史挑战风险最低，适合作为本单首选专家。",
      ranking: context.providerCatalog.map((entry) => {
        if (entry.providerId === recommendedProviderId) {
          return {
            providerId: entry.providerId,
            reason:
              "自报覆盖论文库与行业研报库，能覆盖并行执行、投机执行、冲突检测与产业落地案例；链上信誉和挑战记录也最稳。"
          };
        }
        if (entry.providerId === "shallow-search-provider") {
          return {
            providerId: entry.providerId,
            reason:
              "价格较低，但链上挑战记录较弱，交付完整性的先验风险更高，适合后续挑战分支演示。"
          };
        }
        return {
          providerId: entry.providerId,
          reason:
            "可作为对照候选，但资料库覆盖与本问题的专业匹配度弱于首选专家。"
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
    attempts: 1
  };
}

function buildRealService(): TaskService {
  const root = repoRoot();
  const deployment = parseDeploymentArtifact(
    JSON.parse(readFileSync(join(root, "deployments", "sepolia.json"), "utf8"))
  );
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
  const chain = createChainReader(process.env.SEPOLIA_RPC_URL ?? "");
  const cobo = createCliCoboClient({ srcAddress: deployment.coboWallet });

  // resolveChallenge is only needed when a ChallengeManager is deployed AND the
  // resolver key is available.  Neither is required for the success path, so we
  // build a call-time-throwing stub when either is absent instead of failing at
  // startup.
  const resolverKey = process.env.RESOLVER_PRIVATE_KEY;
  const challengeManagerAddress = deployment.contracts.ProofMarketChallengeManager;
  const resolveChallenge =
    challengeManagerAddress && resolverKey
      ? createChallengeResolver({
          rpcUrl: process.env.SEPOLIA_RPC_URL ?? "",
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
  const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "";
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
          reputationAddress: erc8004.reputationRegistry as `0x${string}`
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
          BigInt(agentId)
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

  const runResearchAgent =
    process.env.PROOFMARKET_PLAN_SOURCE === "preset"
      ? runPresetResearchAgent
      : (context: ResearchContext) => runClaudeResearchAgent(context);

  return createRealTaskService(createInMemoryStore(), {
    deployment,
    providerAddress,
    runResearchAgent,
    cobo,
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
