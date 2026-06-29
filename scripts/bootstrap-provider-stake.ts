/**
 * Bootstrap a demo Provider account for real-mode runs:
 *   - ensure the provider key exists locally (for Hardhat default shallow/general addresses)
 *   - ensure native gas
 *   - mint MockUSDC if needed
 *   - approve + deposit enough stake so freeStake >= minStake
 *
 * Usage:
 *   pnpm exec tsx --env-file=.env scripts/bootstrap-provider-stake.ts execution-research-expert
 *   pnpm exec tsx --env-file=.env scripts/bootstrap-provider-stake.ts shallow-search-provider
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, createWalletClient, formatEther, formatUnits, http, parseEther, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HDNodeWallet } from "ethers";

import { challengeManagerAbi, erc20Abi } from "@proofmarket/chain/src/escrowAbi";
import { getViemChainByChainId } from "@proofmarket/chain/src/chains";
import {
  getProofMarketNetworkByChainId,
  getProofMarketNetworkByName
} from "@proofmarket/shared/src/chains";
import { parseDeploymentArtifact } from "@proofmarket/shared/src/realMode";
import type { ProviderId } from "@proofmarket/shared/src/types";

const PROVIDER_IDS = new Set<ProviderId>([
  "execution-research-expert",
  "shallow-search-provider",
  "general-web-summary"
]);

const HARDHAT_MNEMONIC = "test test test test test test test test test test test junk";
const HARDHAT_INDEX: Partial<Record<ProviderId, number>> = {
  "shallow-search-provider": 2,
  "general-web-summary": 3
};

const ENV_BY_PROVIDER: Record<ProviderId, string[]> = {
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

const mintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;

function repoRoot(): string {
  return resolve(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
}

function artifactPath(): string {
  if (process.env.PROOFMARKET_DEPLOYMENT_PATH) {
    return resolve(process.env.PROOFMARKET_DEPLOYMENT_PATH);
  }
  const network = getProofMarketNetworkByName(
    process.env.PROOFMARKET_NETWORK ?? "injective-testnet"
  );
  return resolve(repoRoot(), "deployments", network.deploymentFile);
}

function loadArtifact() {
  const path = artifactPath();
  if (!existsSync(path)) throw new Error(`deployment artifact not found: ${path}`);
  return parseDeploymentArtifact(JSON.parse(readFileSync(path, "utf8")));
}

function hardhatPrivateKey(index: number): `0x${string}` {
  return HDNodeWallet.fromPhrase(
    HARDHAT_MNEMONIC,
    undefined,
    `m/44'/60'/0'/0/${index}`
  ).privateKey as `0x${string}`;
}

function appendEnvKey(envName: string, privateKey: `0x${string}`): void {
  const envPath = resolve(repoRoot(), ".env");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (new RegExp(`^${envName}=`, "m").test(existing)) return;
  const prefix = existing.endsWith("\n") || existing.length === 0 ? "" : "\n";
  appendFileSync(envPath, `${prefix}${envName}=${privateKey}\n`);
  console.log(`Wrote ${envName} to .env for local testnet signing.`);
}

function providerPrivateKey(providerId: ProviderId, expectedAddress: string): `0x${string}` {
  for (const envName of ENV_BY_PROVIDER[providerId]) {
    const value = process.env[envName];
    if (!value) continue;
    const account = privateKeyToAccount(value as `0x${string}`);
    if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error(`${envName} derives ${account.address}, expected ${expectedAddress}`);
    }
    return value as `0x${string}`;
  }

  const index = HARDHAT_INDEX[providerId];
  if (index == null) {
    throw new Error(`No provider key configured for ${providerId}`);
  }
  const fallback = hardhatPrivateKey(index);
  const account = privateKeyToAccount(fallback);
  if (account.address.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error(
      `Hardhat default account #${index} derives ${account.address}, expected ${expectedAddress}`
    );
  }
  appendEnvKey(ENV_BY_PROVIDER[providerId][0], fallback);
  return fallback;
}

async function main(): Promise<void> {
  const rawProviderId = process.argv[2] ?? "execution-research-expert";
  if (!PROVIDER_IDS.has(rawProviderId as ProviderId)) {
    throw new Error(`unknown provider id: ${rawProviderId}`);
  }
  const providerId = rawProviderId as ProviderId;
  const artifact = loadArtifact();
  const providerEntry = artifact.providers?.[providerId];
  if (!providerEntry) {
    throw new Error(`deployment artifact has no providers["${providerId}"] entry`);
  }
  const challengeManagerAddress = artifact.contracts.ProofMarketChallengeManager;
  if (!challengeManagerAddress) {
    throw new Error("deployment artifact has no ProofMarketChallengeManager");
  }
  const tokenAddress = artifact.paymentToken?.address ?? artifact.contracts.MockUSDC;
  const network = getProofMarketNetworkByChainId(artifact.chainId);
  const rpcUrl = process.env[network.rpcEnvVar] ?? network.defaultRpcUrl;
  const viemChain = getViemChainByChainId(artifact.chainId);

  const providerKey = providerPrivateKey(providerId, providerEntry.address);
  const providerAccount = privateKeyToAccount(providerKey);
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!deployerKey) throw new Error("DEPLOYER_PRIVATE_KEY is required to fund gas/mint test USDC");
  const deployerAccount = privateKeyToAccount(deployerKey);

  const publicClient = createPublicClient({ chain: viemChain, transport: http(rpcUrl) });
  const providerClient = createWalletClient({
    account: providerAccount,
    chain: viemChain,
    transport: http(rpcUrl)
  }).extend(publicActions);
  const deployerClient = createWalletClient({
    account: deployerAccount,
    chain: viemChain,
    transport: http(rpcUrl)
  }).extend(publicActions);

  const minNative = parseEther("0.02");
  const nativeBalance = await publicClient.getBalance({ address: providerAccount.address });
  console.log(`${providerId} address: ${providerAccount.address}`);
  console.log(`Native balance: ${formatEther(nativeBalance)} ${network.nativeCurrency.symbol}`);
  if (nativeBalance < minNative) {
    const hash = await deployerClient.sendTransaction({
      to: providerAccount.address,
      value: minNative - nativeBalance
    });
    await publicClient.waitForTransactionReceipt({ hash, timeout: 420_000 });
    console.log(`Funded provider gas: ${hash}`);
  }

  const minStake = await publicClient.readContract({
    address: challengeManagerAddress as `0x${string}`,
    abi: challengeManagerAbi,
    functionName: "minStake"
  });
  const stake = await publicClient.readContract({
    address: challengeManagerAddress as `0x${string}`,
    abi: challengeManagerAbi,
    functionName: "stake",
    args: [providerAccount.address]
  });
  const lockedStake = await publicClient.readContract({
    address: challengeManagerAddress as `0x${string}`,
    abi: challengeManagerAbi,
    functionName: "lockedStake",
    args: [providerAccount.address]
  });
  const freeStake = stake - lockedStake;
  console.log(
    `Stake: total=${formatUnits(stake, 6)} free=${formatUnits(freeStake, 6)} min=${formatUnits(minStake, 6)}`
  );
  if (freeStake >= minStake) {
    console.log("Provider already has enough free stake.");
    return;
  }

  const needed = minStake - freeStake;
  const tokenBalance = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [providerAccount.address]
  });
  if (tokenBalance < needed) {
    const mintHash = await deployerClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: mintAbi,
      functionName: "mint",
      args: [providerAccount.address, needed - tokenBalance]
    });
    await publicClient.waitForTransactionReceipt({ hash: mintHash, timeout: 420_000 });
    console.log(`Minted provider test USDC: ${mintHash}`);
  }

  const approveHash = await providerClient.writeContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "approve",
    args: [challengeManagerAddress as `0x${string}`, needed]
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 420_000 });
  console.log(`Approved stake transfer: ${approveHash}`);

  const depositHash = await providerClient.writeContract({
    address: challengeManagerAddress as `0x${string}`,
    abi: challengeManagerAbi,
    functionName: "depositStake",
    args: [needed]
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash, timeout: 420_000 });
  console.log(`Deposited provider stake: ${depositHash}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
