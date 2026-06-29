/**
 * deploy-injective.ts
 *
 * Deploys the ProofMarket demo contract stack to Injective EVM testnet:
 *   1. MockUSDC as the demo payment token
 *   2. ProofMarketEscrow
 *   3. ProofMarketChallengeManager
 *   4. Contract wiring + demo mint/stake bootstrap
 *   5. deployments/injective.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { presetJurorIdentities } from "../../shared/src/jurors.ts";
import hre from "hardhat";

const POLICY_SIGNER_WALLET = process.env.POLICY_SIGNER_WALLET_ADDRESS ?? "";
const MINT_TO_POLICY_SIGNER = 100_000_000n; // 100 USDC at 6 decimals

const MIN_STAKE = 10_000_000n;
const CHALLENGE_DEPOSIT = 2_000_000n;
const SLASH_BPS = 5_000n;
const SLASH_REWARD_BPS = 5_000n;
const JURY_FEE = 500_000n;
const DEFENSE_WINDOW = 120n;
const JURY_SIZE = 3n;
const CHALLENGE_WINDOW = 300n;

const PROVIDER_MINT = 20_000_000n;
const EXPERT_STAKE = 20_000_000n;
const CHALLENGER_MINT = 5_000_000n;
const JUROR_GAS_WEI = 20_000_000_000_000_000n; // 0.02 INJ each

const SHALLOW_ADDRESS_FALLBACK = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const GENERAL_ADDRESS_FALLBACK = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

function jurorEnvName(index: number): string {
  return `JUROR${index + 1}_ADDRESS`;
}

async function main() {
  if (!process.env.INJECTIVE_EVM_RPC_URL) {
    throw new Error("INJECTIVE_EVM_RPC_URL not set");
  }
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set");
  }
  if (!POLICY_SIGNER_WALLET.startsWith("0x") || POLICY_SIGNER_WALLET.length !== 42) {
    throw new Error("POLICY_SIGNER_WALLET_ADDRESS must be a 42-char 0x address");
  }

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const providerSigner = signers[1];
  if (!providerSigner) {
    throw new Error(
      "PROVIDER_SIGNER_PRIVATE_KEY not set — a second signer is required to depositStake"
    );
  }

  const resolverAddress = process.env.RESOLVER_ADDRESS ?? deployer.address;
  const treasuryAddress = process.env.TREASURY_ADDRESS ?? deployer.address;
  const challengerAddress = process.env.CHALLENGER_ADDRESS ?? deployer.address;
  const expertAddress = process.env.PROVIDER_EXPERT_ADDRESS ?? providerSigner.address;
  const shallowAddress = process.env.PROVIDER_SHALLOW_ADDRESS ?? SHALLOW_ADDRESS_FALLBACK;
  const generalAddress = process.env.PROVIDER_GENERAL_ADDRESS ?? GENERAL_ADDRESS_FALLBACK;
  const jurorAddresses = presetJurorIdentities.map((_, index) => {
    const envName = jurorEnvName(index);
    const address = process.env[envName] ?? "";
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`${envName} must be a 42-char 0x address`);
    }
    return address;
  });

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Policy signer: ${POLICY_SIGNER_WALLET}`);
  console.log(`Expert provider signer: ${providerSigner.address}`);

  const usdc = await hre.ethers.deployContract("MockUSDC");
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`MockUSDC: ${usdcAddress}`);

  const escrow = await hre.ethers.deployContract("ProofMarketEscrow", [CHALLENGE_WINDOW]);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`ProofMarketEscrow: ${escrowAddress}`);

  const cm = await hre.ethers.deployContract("ProofMarketChallengeManager", [
    usdcAddress,
    treasuryAddress,
    MIN_STAKE,
    CHALLENGE_DEPOSIT,
    SLASH_BPS,
    SLASH_REWARD_BPS,
    JURY_FEE,
    DEFENSE_WINDOW,
    JURY_SIZE
  ]);
  await cm.waitForDeployment();
  const cmAddress = await cm.getAddress();
  console.log(`ProofMarketChallengeManager: ${cmAddress}`);

  await (await escrow.setChallengeManager(cmAddress)).wait();
  await (await cm.setEscrow(escrowAddress)).wait();
  console.log("Wired escrow and challenge manager");

  for (const [index, juror] of presetJurorIdentities.entries()) {
    const modelHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(juror.modelTag));
    const promptHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(juror.promptTag));
    await (await cm.registerJuror(jurorAddresses[index], modelHash, promptHash)).wait();
    console.log(`Registered ${juror.jurorId} @ ${jurorAddresses[index]}`);
  }
  if ((await cm.jurorCount()) !== JURY_SIZE) {
    throw new Error("jury not fully seated after registerJuror");
  }

  for (const [index, address] of jurorAddresses.entries()) {
    const balance = await hre.ethers.provider.getBalance(address);
    if (balance >= JUROR_GAS_WEI) {
      console.log(`Juror ${index + 1} already has ${hre.ethers.formatEther(balance)} INJ`);
      continue;
    }
    await (await deployer.sendTransaction({ to: address, value: JUROR_GAS_WEI - balance })).wait();
    console.log(`Funded juror ${index + 1} to ${hre.ethers.formatEther(JUROR_GAS_WEI)} INJ`);
  }

  const signerMintTx = await usdc.mint(POLICY_SIGNER_WALLET, MINT_TO_POLICY_SIGNER);
  const signerMintReceipt = await signerMintTx.wait();
  if (!signerMintReceipt) throw new Error("policy signer mint tx receipt is null");
  console.log(`Minted 100 USDC to policy signer: ${signerMintReceipt.hash}`);

  await (await usdc.mint(expertAddress, PROVIDER_MINT)).wait();
  const usdcAsProvider = usdc.connect(providerSigner);
  await (await usdcAsProvider.approve(cmAddress, EXPERT_STAKE)).wait();
  await (await cm.connect(providerSigner).depositStake(EXPERT_STAKE)).wait();
  const hasMin = await cm.hasMinStake(expertAddress);
  if (!hasMin) throw new Error("expert provider hasMinStake is false after depositStake");

  await (await usdc.mint(shallowAddress, PROVIDER_MINT)).wait();
  await (await usdc.mint(generalAddress, PROVIDER_MINT)).wait();
  await (await usdc.mint(challengerAddress, CHALLENGER_MINT)).wait();

  const network = await hre.ethers.provider.getNetwork();
  const block = await hre.ethers.provider.getBlockNumber();

  const artifact = {
    chainId: Number(network.chainId),
    network: "injective-testnet",
    deployer: deployer.address,
    blockNumber: block,
    policySignerAddress: POLICY_SIGNER_WALLET,
    contracts: {
      MockUSDC: usdcAddress,
      ProofMarketEscrow: escrowAddress,
      ProofMarketChallengeManager: cmAddress
    },
    paymentToken: {
      symbol: "USDC",
      displayName: "Injective test USDC",
      address: usdcAddress,
      decimals: 6,
      source: "ProofMarket demo MockUSDC deployed on Injective EVM testnet"
    },
    challengeManagerParams: {
      minStake: MIN_STAKE.toString(),
      challengeDeposit: CHALLENGE_DEPOSIT.toString(),
      slashBps: SLASH_BPS.toString(),
      slashRewardBps: SLASH_REWARD_BPS.toString(),
      juryFee: JURY_FEE.toString(),
      defenseWindow: DEFENSE_WINDOW.toString(),
      jurySize: JURY_SIZE.toString()
    },
    escrowParams: {
      challengeWindow: CHALLENGE_WINDOW.toString()
    },
    jurors: presetJurorIdentities.map((juror, index) => ({
      jurorId: juror.jurorId,
      address: jurorAddresses[index],
      modelFamily: juror.modelFamily,
      modelTag: juror.modelTag,
      promptTag: juror.promptTag
    })),
    resolver: resolverAddress,
    treasury: treasuryAddress,
    challenger: {
      address: challengerAddress,
      mintedUsdc: CHALLENGER_MINT.toString()
    },
    providers: {
      "execution-research-expert": {
        address: expertAddress,
        mintedUsdc: PROVIDER_MINT.toString(),
        stakedAmount: EXPERT_STAKE.toString(),
        stakePending: false
      },
      "shallow-search-provider": {
        address: shallowAddress,
        mintedUsdc: PROVIDER_MINT.toString(),
        stakedAmount: "0",
        stakePending: true,
        stakePendingReason: "No private key held by deploy script; provider self-stakes later"
      },
      "general-web-summary": {
        address: generalAddress,
        mintedUsdc: PROVIDER_MINT.toString(),
        stakedAmount: "0",
        stakePending: true,
        stakePendingReason: "No private key held by deploy script; provider self-stakes later"
      }
    },
    mint: {
      to: POLICY_SIGNER_WALLET,
      rawAmount: MINT_TO_POLICY_SIGNER.toString(),
      txHash: signerMintReceipt.hash
    },
    deployedAt: new Date().toISOString()
  };

  if (artifact.chainId !== 1439) {
    throw new Error(`expected Injective EVM testnet chainId 1439, got ${artifact.chainId}`);
  }

  const outDir = join(process.cwd(), "..", "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "injective.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log("Wrote deployments/injective.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
