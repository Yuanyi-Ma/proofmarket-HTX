import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDeploymentArtifact, type DeploymentArtifact } from "@proofmarket/shared/src/realMode";
import {
  getProofMarketNetworkByChainId,
  getProofMarketNetworkByName
} from "@proofmarket/shared/src/chains";
import {
  createDefenseSubmitter,
  createDefenseWindowChecker,
  createJuryVoter
} from "@proofmarket/chain/src/jurySigner";
import { createProviderSubmitter } from "./providerSigner";
import {
  startServicesServer,
  type DefenseOnChain,
  type DefenseWindowRemaining,
  type JuryVoterEntry,
  type SubmitOnChain
} from "./server";
import type { ProviderId } from "@proofmarket/shared/src/types";

const moduleDir = fileURLToPath(new URL(".", import.meta.url));

function repoRoot(): string {
  return join(moduleDir, "..", "..", "..");
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

async function main(): Promise<void> {
  const port = Number(process.env.SERVICES_PORT ?? 4010);
  const providerKeyEnv: Record<ProviderId, string[]> = {
    "execution-research-expert": [
      "PROVIDER_EXECUTION_RESEARCH_EXPERT_PRIVATE_KEY",
      "PROVIDER_SIGNER_PRIVATE_KEY"
    ],
    "shallow-search-provider": [
      "PROVIDER_SHALLOW_SEARCH_PROVIDER_PRIVATE_KEY",
      "PROVIDER_SHALLOW_PRIVATE_KEY"
    ],
    "general-web-summary": [
      "PROVIDER_GENERAL_WEB_SUMMARY_PRIVATE_KEY",
      "PROVIDER_GENERAL_PRIVATE_KEY"
    ]
  };
  const providerIds = Object.keys(providerKeyEnv) as ProviderId[];
  function keyForProvider(providerId: ProviderId): `0x${string}` | null {
    for (const envName of providerKeyEnv[providerId]) {
      const key = process.env[envName];
      if (key) return key as `0x${string}`;
    }
    return null;
  }

  const artifact = loadDeploymentArtifact(repoRoot());
  const network = getProofMarketNetworkByChainId(artifact.chainId);
  const rpcUrl = process.env[network.rpcEnvVar] ?? network.defaultRpcUrl;
  const challengeManagerAddress = artifact.contracts.ProofMarketChallengeManager;

  const submitters = new Map<ProviderId, SubmitOnChain>();
  const defenders = new Map<ProviderId, DefenseOnChain>();
  if (rpcUrl) {
    for (const providerId of providerIds) {
      const privateKey = keyForProvider(providerId);
      if (!privateKey) continue;
      submitters.set(
        providerId,
        createProviderSubmitter({
          rpcUrl,
          privateKey,
          escrowAddress: artifact.contracts.ProofMarketEscrow as `0x${string}`,
          chainId: artifact.chainId
        })
      );
      if (challengeManagerAddress) {
        defenders.set(
          providerId,
          createDefenseSubmitter({
            rpcUrl,
            privateKey,
            challengeManagerAddress: challengeManagerAddress as `0x${string}`,
            chainId: artifact.chainId
          })
        );
      }
    }
  }

  const submitOnChain: SubmitOnChain | null =
    submitters.size > 0
      ? async (input) => {
          const submitter = submitters.get(input.providerId);
          if (!submitter) throw new Error(`provider signer not configured for ${input.providerId}`);
          return submitter(input);
        }
      : null;
  const defenseOnChain: DefenseOnChain | null =
    defenders.size > 0
      ? async (input) => {
          const defender = defenders.get(input.providerId);
          if (!defender) throw new Error(`provider defense signer not configured for ${input.providerId}`);
          return defender(input);
        }
      : null;
  console.log(
    submitOnChain
      ? `Provider on-chain submitters: ENABLED (${[...submitters.keys()].join(", ")})`
      : "Provider on-chain submitters: disabled (no provider key/rpc)"
  );
  console.log(
    defenseOnChain
      ? `Provider defense submitters: ENABLED (${[...defenders.keys()].join(", ")})`
      : "Provider defense submitters: disabled (no provider key/rpc/challenge manager)"
  );

  // Jury operators: one castVote signer per seat, keys from JUROR{1,2,3}_PRIVATE_KEY,
  // seat order matching artifact.jurors (registration order on-chain).
  let juryVoters: JuryVoterEntry[] | null = null;
  const jurorKeys = [
    process.env.JUROR1_PRIVATE_KEY ?? "",
    process.env.JUROR2_PRIVATE_KEY ?? "",
    process.env.JUROR3_PRIVATE_KEY ?? ""
  ];
  const jurors = artifact.jurors ?? [];
  if (
    rpcUrl &&
    challengeManagerAddress &&
    jurors.length === 3 &&
    jurorKeys.every((key) => key.length > 0)
  ) {
    juryVoters = jurors.map((juror, i) => ({
      jurorAddress: juror.address,
      castVote: createJuryVoter({
        rpcUrl,
        privateKey: jurorKeys[i] as `0x${string}`,
        challengeManagerAddress: challengeManagerAddress as `0x${string}`,
        chainId: artifact.chainId
      })
    }));
    console.log(`Jury voters: ENABLED (${juryVoters.length} seats)`);
  } else {
    console.log("Jury voters: disabled (need rpc, challenge manager, artifact.jurors and 3 JURORn_PRIVATE_KEY)");
  }

  const defenseWindowMs =
    Number(artifact.challengeManagerParams?.defenseWindow ?? 0) * 1000;
  const defenseWindowRemaining: DefenseWindowRemaining | null =
    rpcUrl && challengeManagerAddress
      ? createDefenseWindowChecker({
          rpcUrl,
          challengeManagerAddress: challengeManagerAddress as `0x${string}`,
          chainId: artifact.chainId
        })
      : null;

  const server = await startServicesServer({
    port,
    submitOnChain,
    defenseOnChain,
    juryVoters,
    defenseWindowMs,
    defenseWindowRemaining
  });
  console.log(`ProofMarket services listening at ${server.url}`);
}

main().catch((error) => {
  console.error("boot error:", error);
  process.exit(1);
});
