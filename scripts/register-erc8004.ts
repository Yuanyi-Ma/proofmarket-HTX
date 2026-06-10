/**
 * scripts/register-erc8004.ts  (P1-1)
 *
 * Registers the 3 demo providers as ERC-8004 agents on Sepolia's OFFICIAL
 * IdentityRegistry, posts deterministic seed reputation via the official
 * ReputationRegistry, then reads everything back to prove it landed on-chain.
 *
 * Usage:
 *   set -a; source .env; set +a; pnpm tsx scripts/register-erc8004.ts
 *
 * Roles:
 *   - REGISTRANT = DEPLOYER_PRIVATE_KEY  → becomes ERC-721 owner of all 3 agents
 *   - RATER      = PROVIDER_SIGNER_PRIVATE_KEY → posts seed feedback (must NOT
 *     be the agents' owner: ReputationRegistry reverts "Self-feedback not allowed")
 *
 * ⚠ NOT idempotent: ERC-8004 registration mints a fresh ERC-721 per call.
 *   Rerunning this script registers 3 NEW agentIds (and re-posts seed feedback
 *   against the new ids); the artifact is overwritten with the latest ids.
 *   The previously registered agents stay on-chain but are abandoned.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createIdentityClient,
  createReputationClient,
  readAgent,
  readReputationSummary
} from "@proofmarket/chain/src/erc8004";
import { providerProfiles } from "@proofmarket/shared/src/fixtures";
import { parseDeploymentArtifact } from "@proofmarket/shared/src/realMode";

type Hex = `0x${string}`;

// Official ERC-8004 UUPS proxies on Sepolia (call via proxy addresses).
const IDENTITY_REGISTRY: Hex = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY: Hex = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

// Deterministic seed reputation, scaled by valueDecimals=2 (480 → 4.80).
const SEED_VALUE_DECIMALS = 2;
const SEED_TAG1 = "proofmarket";
const SEED_TAG2 = "seed";
const SEED_VALUES: Record<string, bigint> = {
  "execution-research-expert": 480n,
  "general-web-summary": 350n,
  "shallow-search-provider": 200n
};

const REPO_ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const ARTIFACT_PATH = resolve(REPO_ROOT, "deployments", "sepolia.json");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");
  const deployerKey = requireEnv("DEPLOYER_PRIVATE_KEY") as Hex;
  const raterKey = requireEnv("PROVIDER_SIGNER_PRIVATE_KEY") as Hex;

  console.log("⚠ This script registers FRESH ERC-8004 agents on every run (ids increment).");
  console.log(`  IdentityRegistry:   ${IDENTITY_REGISTRY}`);
  console.log(`  ReputationRegistry: ${REPUTATION_REGISTRY}`);
  console.log("");

  const artifact = parseDeploymentArtifact(JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")));
  if (!artifact.providers) throw new Error("artifact has no providers section");

  const providerIds = providerProfiles.map((p) => p.id);
  for (const id of providerIds) {
    if (!artifact.providers[id]) throw new Error(`artifact missing provider entry: ${id}`);
    if (SEED_VALUES[id] === undefined) throw new Error(`no seed value defined for: ${id}`);
  }

  const identity = createIdentityClient({
    rpcUrl,
    privateKey: deployerKey,
    identityAddress: IDENTITY_REGISTRY
  });
  const reputation = createReputationClient({
    rpcUrl,
    privateKey: raterKey,
    reputationAddress: REPUTATION_REGISTRY
  });

  // ── 1. Register the 3 providers (sequential: same nonce account) ──────────
  const registered: Record<string, { agentId: bigint; agentURI: string; txHash: string }> = {};
  for (const id of providerIds) {
    const agentURI = `proofmarket://agent/${id}`;
    console.log(`[register] ${id} → register("${agentURI}") ...`);
    const { agentId, txHash } = await identity.register(agentURI);
    registered[id] = { agentId, agentURI, txHash };
    console.log(`[register] ${id} → agentId=${agentId} tx=${txHash}`);
  }
  console.log("");

  // ── 2. Post seed reputation (rater ≠ owner, so no self-feedback revert) ───
  const feedbackTxs: Record<string, string> = {};
  for (const id of providerIds) {
    const { agentId } = registered[id];
    const value = SEED_VALUES[id];
    console.log(
      `[seed] ${id} → giveFeedback(agentId=${agentId}, value=${value}, decimals=${SEED_VALUE_DECIMALS}, ` +
        `tag1="${SEED_TAG1}", tag2="${SEED_TAG2}") ...`
    );
    const { txHash } = await reputation.giveFeedback({
      agentId,
      value,
      valueDecimals: SEED_VALUE_DECIMALS,
      tag1: SEED_TAG1,
      tag2: SEED_TAG2,
      endpoint: "",
      feedbackURI: `proofmarket://seed/${id}`
    });
    feedbackTxs[id] = txHash;
    console.log(`[seed] ${id} → tx=${txHash}`);
  }
  console.log("");

  // ── 3. Read back from chain to prove it landed ────────────────────────────
  console.log("── Read-back proof ──");
  for (const id of providerIds) {
    const { agentId, agentURI } = registered[id];
    const agent = await readAgent(rpcUrl, IDENTITY_REGISTRY, agentId);
    const summary = await readReputationSummary(rpcUrl, REPUTATION_REGISTRY, agentId);
    console.log(`${id} (agentId=${agentId}):`);
    console.log(`  ownerOf   = ${agent.owner}`);
    console.log(`  tokenURI  = ${agent.agentURI}`);
    console.log(
      `  getSummary = count=${summary.count} value=${summary.value} decimals=${summary.decimals}`
    );
    if (agent.agentURI !== agentURI) {
      throw new Error(`tokenURI mismatch for ${id}: got "${agent.agentURI}"`);
    }
  }
  console.log("");

  // ── 4. Update the deployment artifact (keep all existing fields) ──────────
  for (const id of providerIds) {
    artifact.providers[id] = {
      ...artifact.providers[id],
      agentId: Number(registered[id].agentId),
      agentURI: registered[id].agentURI
    };
  }
  artifact.erc8004 = {
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY
  };
  // Re-validate before writing so a broken artifact never lands on disk.
  parseDeploymentArtifact(artifact);
  writeFileSync(ARTIFACT_PATH, JSON.stringify(artifact, null, 2) + "\n");
  console.log(`Artifact updated: ${ARTIFACT_PATH}`);
  console.log("");
  console.log("Summary:");
  for (const id of providerIds) {
    console.log(
      `  ${id}: agentId=${registered[id].agentId} registerTx=${registered[id].txHash} seedTx=${feedbackTxs[id]}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
