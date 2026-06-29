/**
 * scripts/check-real-env.ts
 * Preflight checks for real-mode (Injective/Sepolia + restricted signer + Codex/Claude) operation.
 *
 * Usage:
 *   pnpm preflight
 *   (or: npx tsx --env-file=.env scripts/check-real-env.ts)
 *
 * Prints PASS / FAIL / INFO per check and exits 1 if any FAIL.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { createPublicClient, formatEther, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { getViemChainByChainId } from "@proofmarket/chain/src/chains";
import { challengeManagerAbi, erc20Abi } from "@proofmarket/chain/src/escrowAbi";
import { getProofMarketNetworkByChainId, getProofMarketNetworkByName } from "@proofmarket/shared/src/chains";
import { parseDeploymentArtifact } from "@proofmarket/shared/src/realMode";

const execFileAsync = promisify(execFile);

const REPO_ROOT = resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
const requestedNetwork = process.env.PROOFMARKET_NETWORK ?? "injective-testnet";
const ARTIFACT_PATH = process.env.PROOFMARKET_DEPLOYMENT_PATH
  ? resolve(process.env.PROOFMARKET_DEPLOYMENT_PATH)
  : resolve(REPO_ROOT, "deployments", getProofMarketNetworkByName(requestedNetwork).deploymentFile);

let failed = false;

function pass(name: string, detail: string): void {
  console.log(`PASS ${name}: ${detail}`);
}

function fail(name: string, reason: string): void {
  console.log(`FAIL ${name}: ${reason}`);
  failed = true;
}

function info(name: string, detail: string): void {
  console.log(`INFO ${name}: ${detail}`);
}

async function runCommand(
  cmd: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const result = await execFileAsync(cmd, args);
    return { stdout: result.stdout.trim(), stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return {
      stdout: e.stdout?.trim() ?? "",
      stderr: e.stderr?.trim() ?? e.message ?? String(err),
      code: typeof e.code === "number" ? e.code : 1
    };
  }
}

async function checkDeploymentArtifact(): Promise<ReturnType<typeof parseDeploymentArtifact> | null> {
  const name = "deployment_artifact";
  if (!existsSync(ARTIFACT_PATH)) {
    fail(
      name,
      `${ARTIFACT_PATH} not found. Deploy the contract stack for ${requestedNetwork} first.`
    );
    return null;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
  } catch (err) {
    fail(name, `${ARTIFACT_PATH} is not valid JSON: ${String(err)}`);
    return null;
  }

  try {
    const artifact = parseDeploymentArtifact(raw);
    pass(name, `chainId=${artifact.chainId}, deployer=${artifact.deployer}, MockUSDC=${artifact.contracts.MockUSDC}`);
    return artifact;
  } catch (err) {
    fail(name, `${ARTIFACT_PATH} failed validation: ${String(err)}. Re-run the deploy command above.`);
    return null;
  }
}

function checkEnvVars(rpcEnvVar: string): void {
  const required = [
    rpcEnvVar,
    "POLICY_SIGNER_WALLET_ADDRESS",
    "POLICY_SIGNER_PRIVATE_KEY",
    "PROVIDER_SIGNER_ADDRESS",
    "PROVIDER_SIGNER_PRIVATE_KEY"
  ] as const;
  // Vars whose values must never be printed — show only presence
  const secretVars = new Set(["POLICY_SIGNER_PRIVATE_KEY", "PROVIDER_SIGNER_PRIVATE_KEY"]);
  for (const varName of required) {
    const value = process.env[varName];
    if (!value) {
      fail(`env_${varName}`, `${varName} is not set. Add it to .env (see .env.example).`);
    } else if (secretVars.has(varName)) {
      pass(`env_${varName}`, "(set)");
    } else {
      pass(`env_${varName}`, value.slice(0, 20) + (value.length > 20 ? "…" : ""));
    }
  }
}

function checkProviderKeyMatchesAddress(): void {
  const name = "provider_key_matches_address";
  const privateKey = process.env.PROVIDER_SIGNER_PRIVATE_KEY;
  const address = process.env.PROVIDER_SIGNER_ADDRESS;
  if (!privateKey || !address) {
    fail(
      name,
      "PROVIDER_SIGNER_PRIVATE_KEY or PROVIDER_SIGNER_ADDRESS is not set — cannot verify the provider identity."
    );
    return;
  }
  let derived: string;
  try {
    derived = privateKeyToAccount(privateKey as `0x${string}`).address;
  } catch (err) {
    const hint = /^[0-9a-fA-F]{64}$/.test(privateKey)
      ? " It looks like a 64-char hex key missing the 0x prefix — the services boot passes it to viem verbatim, so add 0x in .env."
      : "";
    fail(name, `PROVIDER_SIGNER_PRIVATE_KEY is not a valid private key: ${String(err)}.${hint}`);
    return;
  }
  if (derived.toLowerCase() !== address.toLowerCase()) {
    fail(
      name,
      `PROVIDER_SIGNER_PRIVATE_KEY derives ${derived}, but PROVIDER_SIGNER_ADDRESS is ${address}. ` +
        "submit() would revert — fix .env so the key and address belong to the same account."
    );
    return;
  }
  pass(name, `private key derives ${derived} (matches PROVIDER_SIGNER_ADDRESS)`);
}

function checkPolicySignerKeyMatchesAddress(): void {
  const name = "policy_signer_key_matches_address";
  const privateKey = process.env.POLICY_SIGNER_PRIVATE_KEY;
  const address = process.env.POLICY_SIGNER_WALLET_ADDRESS;
  if (!privateKey || !address) {
    fail(
      name,
      "POLICY_SIGNER_PRIVATE_KEY or POLICY_SIGNER_WALLET_ADDRESS is not set — cannot verify the restricted signer identity."
    );
    return;
  }
  let derived: string;
  try {
    derived = privateKeyToAccount(privateKey as `0x${string}`).address;
  } catch (err) {
    const hint = /^[0-9a-fA-F]{64}$/.test(privateKey)
      ? " It looks like a 64-char hex key missing the 0x prefix — add 0x in .env."
      : "";
    fail(name, `POLICY_SIGNER_PRIVATE_KEY is not a valid private key: ${String(err)}.${hint}`);
    return;
  }
  if (derived.toLowerCase() !== address.toLowerCase()) {
    fail(
      name,
      `POLICY_SIGNER_PRIVATE_KEY derives ${derived}, but POLICY_SIGNER_WALLET_ADDRESS is ${address}. ` +
        "restricted signing would submit from the wrong account."
    );
    return;
  }
  pass(name, `private key derives ${derived} (matches POLICY_SIGNER_WALLET_ADDRESS)`);
}

async function checkGasBalance(
  client: ReturnType<typeof createPublicClient>,
  label: string,
  address: `0x${string}`,
  minEth: number
): Promise<void> {
  const name = `gas_${label}`;
  try {
    const balance = await client.getBalance({ address });
    const ethVal = Number(formatEther(balance));
    if (ethVal < minEth) {
      fail(
        name,
        `${address} has ${ethVal.toFixed(6)} SETH, need ≥ ${minEth} SETH. Top up the signer address from a Sepolia faucet or another test account.`
      );
    } else {
      pass(name, `${address} has ${ethVal.toFixed(6)} SETH (≥ ${minEth} required)`);
    }
  } catch (err) {
    fail(name, `Failed to read balance for ${address}: ${String(err)}`);
  }
}

async function checkMockUsdcBalance(
  client: ReturnType<typeof createPublicClient>,
  policySignerAddress: `0x${string}`,
  usdcAddress: `0x${string}`
): Promise<void> {
  const name = "usdc_balance_policy_signer";
  const MIN_RAW = 5_000_000n;
  try {
    const raw = await client.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [policySignerAddress]
    });
    const balance = raw as bigint;
    if (balance < MIN_RAW) {
      fail(
        name,
        `Restricted signer MockUSDC balance ${balance} raw < ${MIN_RAW} required. Mint more via the deploy script or re-deploy.`
      );
    } else {
      pass(name, `Restricted signer MockUSDC balance = ${balance} raw (≥ ${MIN_RAW} required)`);
    }
  } catch (err) {
    fail(name, `Failed to read MockUSDC balanceOf: ${String(err)}`);
  }
}

function formatMUSDC(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const fractional = (raw % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${fractional ? `.${fractional}` : ""} mUSDC`;
}

async function checkProviderFreeStake(
  client: ReturnType<typeof createPublicClient>,
  challengeManagerAddress: `0x${string}`,
  providerAddress: `0x${string}`
): Promise<void> {
  const name = "provider_free_stake";
  try {
    const [stake, lockedStake, minStake] = await Promise.all([
      client.readContract({
        address: challengeManagerAddress,
        abi: challengeManagerAbi,
        functionName: "stake",
        args: [providerAddress]
      }),
      client.readContract({
        address: challengeManagerAddress,
        abi: challengeManagerAbi,
        functionName: "lockedStake",
        args: [providerAddress]
      }),
      client.readContract({
        address: challengeManagerAddress,
        abi: challengeManagerAbi,
        functionName: "minStake"
      })
    ]);
    const freeStake = stake - lockedStake;
    if (freeStake < minStake) {
      fail(
        name,
        `Provider ${providerAddress} has only ${formatMUSDC(freeStake)} free stake; ` +
          `needs ${formatMUSDC(minStake)} to create another job ` +
          `(total ${formatMUSDC(stake)}, locked ${formatMUSDC(lockedStake)}). ` +
          "Release stranded jobs or deposit more provider stake before the demo."
      );
    } else {
      pass(
        name,
        `Provider ${providerAddress} free stake ${formatMUSDC(freeStake)} ` +
          `≥ minStake ${formatMUSDC(minStake)} ` +
          `(total ${formatMUSDC(stake)}, locked ${formatMUSDC(lockedStake)})`
      );
    }
  } catch (err) {
    fail(name, `Failed to read provider stake: ${String(err)}`);
  }
}

async function checkServicesReachable(): Promise<void> {
  const name = "services_reachable";
  const servicesUrl = process.env.SERVICES_URL ?? "http://localhost:4010";
  const url = `${servicesUrl}/judge/verify`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskId: "preflight-check", packageHash: "0x0000" }),
      signal: AbortSignal.timeout(5000)
    });
    if (resp.status >= 500) {
      fail(
        name,
        `${url} returned ${resp.status} — service is up but erroring. Check pnpm dev:services logs.`
      );
    } else {
      // 2xx–4xx means the server is reachable; payload mismatch is ok for preflight
      pass(name, `${url} returned ${resp.status} (service is running)`);
    }
  } catch (err) {
    fail(
      name,
      `Cannot reach ${url}: ${String(err)}. Run: pnpm dev:services (in a separate terminal)`
    );
  }
}

async function checkResearchAgentBin(): Promise<void> {
  const source = process.env.PROOFMARKET_PLAN_SOURCE ?? "codex";
  if (source === "preset") {
    info("research_agent_binary", "PROOFMARKET_PLAN_SOURCE=preset — no external agent binary required");
    return;
  }

  const name = source === "claude" ? "claude_binary" : "codex_binary";
  const bin = source === "claude" ? process.env.CLAUDE_BIN ?? "claude" : process.env.CODEX_BIN ?? "codex";
  const result = await runCommand(bin, ["--version"]);
  if (result.code !== 0) {
    fail(
      name,
      `"${bin} --version" failed (exit ${result.code}): ${result.stderr || result.stdout}. Set ${source === "claude" ? "CLAUDE_BIN" : "CODEX_BIN"} in .env to the correct binary path.`
    );
  } else {
    pass(name, `${bin} — ${result.stdout || "ok"}`);
  }

  if (source === "codex") {
    const tier = process.env.PROOFMARKET_CODEX_SERVICE_TIER ?? "fast";
    if (tier !== "fast" && tier !== "flex") {
      fail(
        "codex_service_tier",
        `PROOFMARKET_CODEX_SERVICE_TIER must be fast or flex, got ${tier}`
      );
    } else {
      pass("codex_service_tier", tier);
    }
  }
}

async function main(): Promise<void> {
  console.log("=== ProofMarket Real-Mode Preflight ===\n");

  // 1. Deployment artifact
  const artifact = await checkDeploymentArtifact();

  const network = artifact
    ? getProofMarketNetworkByChainId(artifact.chainId)
    : getProofMarketNetworkByName(requestedNetwork);

  // 2. Env vars
  checkEnvVars(network.rpcEnvVar);

  // 2b. Signer keys must derive the configured addresses.
  checkPolicySignerKeyMatchesAddress();
  checkProviderKeyMatchesAddress();

  // 3-6: On-chain checks — only run if we have the RPC URL
  const rpcUrl = process.env[network.rpcEnvVar];
  if (rpcUrl) {
    const client = createPublicClient({
      chain: getViemChainByChainId(artifact?.chainId ?? network.chainId),
      transport: http(rpcUrl)
    });

    const policySignerAddress = process.env.POLICY_SIGNER_WALLET_ADDRESS as `0x${string}` | undefined;
    const providerSignerAddress = process.env.PROVIDER_SIGNER_ADDRESS as `0x${string}` | undefined;

    // 3. Restricted signer gas
    if (policySignerAddress) {
      await checkGasBalance(client, "policy_signer", policySignerAddress, 0.005);
    } else {
      fail("gas_policy_signer", "POLICY_SIGNER_WALLET_ADDRESS not set — skipped balance check");
    }

    // 4. Deployer gas — derived from artifact
    if (artifact) {
      await checkGasBalance(client, "deployer", artifact.deployer as `0x${string}`, 0.003);
    } else {
      fail("gas_deployer", "Deployment artifact missing — cannot check deployer balance");
    }

    // 5. Provider signer gas
    if (providerSignerAddress) {
      await checkGasBalance(client, "provider_signer", providerSignerAddress, 0.001);
    } else {
      fail("gas_provider_signer", "PROVIDER_SIGNER_ADDRESS not set — skipped balance check");
    }

    // 6. Restricted signer MockUSDC balance
    if (artifact && policySignerAddress) {
      await checkMockUsdcBalance(
        client,
        policySignerAddress,
        artifact.contracts.MockUSDC as `0x${string}`
      );
    } else {
      fail(
        "usdc_balance_policy_signer",
        "Artifact or POLICY_SIGNER_WALLET_ADDRESS missing — cannot check MockUSDC balance"
      );
    }

    // 6b. Provider free stake must cover one more createJob lock.
    const challengeManagerAddress = artifact?.contracts.ProofMarketChallengeManager;
    if (challengeManagerAddress && providerSignerAddress) {
      await checkProviderFreeStake(
        client,
        challengeManagerAddress as `0x${string}`,
        providerSignerAddress
      );
    } else {
      fail(
        "provider_free_stake",
        "Artifact ProofMarketChallengeManager or PROVIDER_SIGNER_ADDRESS missing — cannot check provider free stake"
      );
    }
  } else {
    for (const n of ["gas_policy_signer", "gas_deployer", "gas_provider_signer", "usdc_balance_policy_signer", "provider_free_stake"]) {
      fail(n, `${network.rpcEnvVar} not set — skipped on-chain check`);
    }
  }

  // 7. Services reachable
  await checkServicesReachable();

  // 8. Research agent binary
  await checkResearchAgentBin();

  console.log("\n=== Preflight complete ===");
  if (failed) {
    console.log("Status: FAILED — fix the FAIL items above before running pnpm demo:real\n");
    process.exit(1);
  } else {
    console.log("Status: PASSED — ready for real-mode demo\n");
  }
}

main().catch((err) => {
  console.error("Preflight crashed unexpectedly:", err);
  process.exit(1);
});
