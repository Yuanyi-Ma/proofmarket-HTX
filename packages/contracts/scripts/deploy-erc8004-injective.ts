/**
 * Deploys ProofMarket's minimal ERC-8004-compatible identity/reputation
 * registries to Injective EVM testnet, registers the demo providers, posts
 * seed reputation, and writes the resulting agent ids into deployments/injective.json.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   pnpm --filter @proofmarket/contracts exec hardhat run scripts/deploy-erc8004-injective.ts --network injectiveTestnet
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import hre from "hardhat";

const SEED_VALUE_DECIMALS = 2;
const SEED_TAG1 = "proofmarket";
const SEED_TAG2 = "seed";
const PROVIDERS = [
  { id: "execution-research-expert" },
  { id: "shallow-search-provider" },
  { id: "general-web-summary" }
] as const;
const SEED_VALUES: Record<string, bigint> = {
  "execution-research-expert": 480n,
  "general-web-summary": 350n,
  "shallow-search-provider": 200n
};

function artifactPath(): string {
  return join(process.cwd(), "..", "..", "deployments", "injective.json");
}

function isAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function parseInjectiveArtifact(input: unknown) {
  const artifact = input as {
    chainId?: number;
    providers?: Record<string, Record<string, unknown>>;
    erc8004?: { identityRegistry: string; reputationRegistry: string };
  };
  if (!artifact || typeof artifact !== "object") throw new Error("artifact must be an object");
  if (artifact.chainId !== 1439) {
    throw new Error(`expected Injective EVM testnet artifact chainId 1439, got ${artifact.chainId}`);
  }
  if (!artifact.providers) throw new Error("artifact has no providers section");
  return artifact;
}

async function registerAgent(
  identity: Awaited<ReturnType<typeof hre.ethers.deployContract>>,
  providerId: string
): Promise<{ agentId: bigint; agentURI: string; txHash: string }> {
  const agentURI = `proofmarket://agent/${providerId}`;
  const tx = await identity.register(agentURI);
  const receipt = await tx.wait();
  if (!receipt) throw new Error(`register receipt missing for ${providerId}`);

  const registered = receipt.logs
    .map((log) => {
      try {
        return identity.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event) => event?.name === "Registered");
  const agentId = registered?.args.agentId as bigint | undefined;
  if (agentId === undefined) {
    throw new Error(`Registered event missing for ${providerId}`);
  }

  return { agentId, agentURI, txHash: receipt.hash };
}

async function main() {
  if (!process.env.INJECTIVE_EVM_RPC_URL) {
    throw new Error("INJECTIVE_EVM_RPC_URL not set");
  }
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }
  if (!process.env.PROVIDER_SIGNER_PRIVATE_KEY) {
    throw new Error("PROVIDER_SIGNER_PRIVATE_KEY not set");
  }

  const path = artifactPath();
  const artifact = parseInjectiveArtifact(JSON.parse(readFileSync(path, "utf8")));

  const [deployer, rater] = await hre.ethers.getSigners();
  if (!rater) {
    throw new Error("PROVIDER_SIGNER_PRIVATE_KEY must be configured as the second Hardhat signer");
  }
  if (deployer.address.toLowerCase() === rater.address.toLowerCase()) {
    throw new Error("rater must not equal deployer because self-feedback is rejected");
  }

  const identity = await hre.ethers.deployContract("ProofMarketIdentityRegistry");
  await identity.waitForDeployment();
  const identityAddress = await identity.getAddress();
  console.log(`ProofMarketIdentityRegistry: ${identityAddress}`);

  const reputation = await hre.ethers.deployContract("ProofMarketReputationRegistry", [
    identityAddress
  ]);
  await reputation.waitForDeployment();
  const reputationAddress = await reputation.getAddress();
  console.log(`ProofMarketReputationRegistry: ${reputationAddress}`);

  const reputationAsRater = reputation.connect(rater);
  const registered: Record<string, { agentId: bigint; agentURI: string; registerTx: string; seedTx: string }> = {};

  for (const provider of PROVIDERS) {
    if (!artifact.providers[provider.id]) {
      throw new Error(`artifact missing provider entry: ${provider.id}`);
    }
    if (SEED_VALUES[provider.id] === undefined) {
      throw new Error(`no seed value defined for provider: ${provider.id}`);
    }

    console.log(`[register] ${provider.id}`);
    const { agentId, agentURI, txHash } = await registerAgent(identity, provider.id);
    console.log(`[register] ${provider.id} agentId=${agentId} tx=${txHash}`);

    const seedTx = await reputationAsRater.giveFeedback(
      agentId,
      SEED_VALUES[provider.id],
      SEED_VALUE_DECIMALS,
      SEED_TAG1,
      SEED_TAG2,
      "",
      `proofmarket://seed/${provider.id}`,
      hre.ethers.ZeroHash
    );
    const seedReceipt = await seedTx.wait();
    if (!seedReceipt) throw new Error(`seed feedback receipt missing for ${provider.id}`);
    console.log(`[seed] ${provider.id} tx=${seedReceipt.hash}`);

    registered[provider.id] = {
      agentId,
      agentURI,
      registerTx: txHash,
      seedTx: seedReceipt.hash
    };
  }

  console.log("── Read-back proof ──");
  for (const provider of PROVIDERS) {
    const entry = registered[provider.id];
    const owner = await identity.ownerOf(entry.agentId);
    const tokenURI = await identity.tokenURI(entry.agentId);
    const clients = Array.from(await reputation.getClients(entry.agentId));
    const summary = await reputation.getSummary(entry.agentId, clients, SEED_TAG1, SEED_TAG2);
    console.log(
      `${provider.id}: owner=${owner} tokenURI=${tokenURI} count=${summary.count} value=${summary.summaryValue} decimals=${summary.summaryValueDecimals}`
    );
    if (tokenURI !== entry.agentURI) {
      throw new Error(`tokenURI mismatch for ${provider.id}`);
    }
    if (summary.count !== 1n) {
      throw new Error(`expected one seed feedback for ${provider.id}, got ${summary.count}`);
    }
  }

  for (const provider of PROVIDERS) {
    artifact.providers[provider.id] = {
      ...artifact.providers[provider.id],
      agentId: Number(registered[provider.id].agentId),
      agentURI: registered[provider.id].agentURI
    };
  }
  artifact.erc8004 = {
    identityRegistry: identityAddress,
    reputationRegistry: reputationAddress
  };

  if (!isAddress(artifact.erc8004.identityRegistry)) {
    throw new Error("artifact erc8004.identityRegistry is not a valid address");
  }
  if (!isAddress(artifact.erc8004.reputationRegistry)) {
    throw new Error("artifact erc8004.reputationRegistry is not a valid address");
  }
  writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`Updated ${path}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
