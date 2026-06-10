/**
 * deploy-sepolia.ts
 *
 * Deploys the full ProofMarket contract stack for the Sepolia demo:
 *   1. MockUSDC
 *   2. ProofMarketEscrow
 *   3. ProofMarketChallengeManager  (new in P0-2)
 *   4. Wire: escrow.setChallengeManager + cm.setEscrow
 *   5. Expert provider: mint + depositStake (using PROVIDER_SIGNER_PRIVATE_KEY)
 *   6. Catalog-only providers (shallow-search, general-web): mint USDC only
 *      — no keys held, stake is "pending" until P1 registers them on-chain
 *   7. Challenger: mint challengeDeposit-worth of MockUSDC
 *
 * Resolver & treasury choice
 * ──────────────────────────
 * In the demo the backend/verifier acts as resolver (it inspects deliverables
 * and calls cm.resolve()).  We default both resolver and treasury to the
 * deployer address so the script is self-contained; override with env vars
 * RESOLVER_ADDRESS and TREASURY_ADDRESS when running against real Sepolia.
 *
 * Provider staking strategy
 * ─────────────────────────
 * depositStake() credits msg.sender, so only the signer whose key we hold can
 * self-stake.  We hold PROVIDER_SIGNER_PRIVATE_KEY (expert provider key).
 * The other two catalog providers (shallow-search, general-web) receive minted
 * MockUSDC but are marked "stakePending:true" in the artifact — they will
 * self-stake in P1 once their ERC-8004 identities are registered.
 *
 * Local smoke test usage (no real funds):
 *   SEPOLIA_RPC_URL=http://127.0.0.1:8545 \
 *   DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
 *   PROVIDER_SIGNER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d \
 *   COBO_WALLET_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
 *   pnpm hardhat run scripts/deploy-sepolia.ts --network sepolia
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import hre from "hardhat";

// ─── Config ──────────────────────────────────────────────────────────────────

const COBO_WALLET = process.env.COBO_WALLET_ADDRESS ?? "";
const MINT_TO_COBO = 100_000_000n; // 100 mUSDC at 6 decimals

// ChallengeManager constructor params (match spec §合约参数)
const MIN_STAKE         = 10_000_000n; // 10 mUSDC
const CHALLENGE_DEPOSIT =  2_000_000n; //  2 mUSDC
const SLASH_BPS         =      5_000n; // 50 %
const SLASH_REWARD_BPS  =      5_000n; // 50 % of slashed amount → challenger

// Each provider gets 20 mUSDC minted; expert stakes the full 20 mUSDC.
const PROVIDER_MINT     = 20_000_000n; // 20 mUSDC
const EXPERT_STAKE      = 20_000_000n; // 20 mUSDC (covers 2 concurrent jobs at minStake 10)
// Challenger receives enough to open one challenge.
const CHALLENGER_MINT   =  5_000_000n; //  5 mUSDC

// Demo provider addresses.  In a real Sepolia run these come from env.
// For the local smoke test the deployer key is Hardhat #0 and provider key is
// Hardhat #1, so PROVIDER_EXPERT_ADDRESS defaults to the signers[1] address.
// Shallow-search and general-web are Hardhat #2 / #3 (no keys in script);
// they receive minted USDC but their stake stays pending until P1.
const SHALLOW_ADDRESS_FALLBACK = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // HH #2
const GENERAL_ADDRESS_FALLBACK = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // HH #3

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.SEPOLIA_RPC_URL)     throw new Error("SEPOLIA_RPC_URL not set");
  if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  if (!COBO_WALLET.startsWith("0x") || COBO_WALLET.length !== 42) {
    throw new Error("COBO_WALLET_ADDRESS must be a 42-char 0x address");
  }

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  console.log(`Deployer: ${deployer.address}`);

  // Expert provider signer — required so we can call depositStake as that address.
  const providerSigner = signers[1];
  if (!providerSigner) {
    throw new Error(
      "PROVIDER_SIGNER_PRIVATE_KEY not set — a second signer is required to depositStake on behalf of the expert provider"
    );
  }
  console.log(`Expert provider signer: ${providerSigner.address}`);

  // Resolver + treasury: default to deployer for demo simplicity.
  const resolverAddress  = process.env.RESOLVER_ADDRESS  ?? deployer.address;
  const treasuryAddress  = process.env.TREASURY_ADDRESS  ?? deployer.address;
  const challengerAddress = process.env.CHALLENGER_ADDRESS ?? deployer.address;
  const expertAddress    = process.env.PROVIDER_EXPERT_ADDRESS ?? providerSigner.address;
  const shallowAddress   = process.env.PROVIDER_SHALLOW_ADDRESS ?? SHALLOW_ADDRESS_FALLBACK;
  const generalAddress   = process.env.PROVIDER_GENERAL_ADDRESS ?? GENERAL_ADDRESS_FALLBACK;

  console.log(`Resolver:   ${resolverAddress}`);
  console.log(`Treasury:   ${treasuryAddress}`);
  console.log(`Challenger: ${challengerAddress}`);
  console.log(`Provider (expert):  ${expertAddress}`);
  console.log(`Provider (shallow): ${shallowAddress}`);
  console.log(`Provider (general): ${generalAddress}`);

  // ── 1. Deploy MockUSDC ─────────────────────────────────────────────────────
  const usdc = await hre.ethers.deployContract("MockUSDC");
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`MockUSDC: ${usdcAddress}`);

  // ── 2. Deploy ProofMarketEscrow ────────────────────────────────────────────
  const escrow = await hre.ethers.deployContract("ProofMarketEscrow");
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`ProofMarketEscrow: ${escrowAddress}`);

  // ── 3. Deploy ProofMarketChallengeManager ──────────────────────────────────
  // Constructor: (token_, resolver_, treasury_, minStake_, challengeDeposit_,
  //               slashBps_, slashRewardBps_)
  const cm = await hre.ethers.deployContract("ProofMarketChallengeManager", [
    usdcAddress,
    resolverAddress,
    treasuryAddress,
    MIN_STAKE,
    CHALLENGE_DEPOSIT,
    SLASH_BPS,
    SLASH_REWARD_BPS
  ]);
  await cm.waitForDeployment();
  const cmAddress = await cm.getAddress();
  console.log(`ProofMarketChallengeManager: ${cmAddress}`);

  // ── 4. Wire the two contracts (once-only owner setters) ────────────────────
  const wireTx1 = await escrow.setChallengeManager(cmAddress);
  await wireTx1.wait();
  console.log("Wired: escrow.setChallengeManager ✓");

  const wireTx2 = await cm.setEscrow(escrowAddress);
  await wireTx2.wait();
  console.log("Wired: cm.setEscrow ✓");

  // ── 5. Mint USDC to Cobo wallet (existing behaviour) ──────────────────────
  const coboMintTx = await usdc.mint(COBO_WALLET, MINT_TO_COBO);
  const coboMintReceipt = await coboMintTx.wait();
  if (!coboMintReceipt) throw new Error("Cobo mint tx receipt is null");
  console.log(`Minted 100 mUSDC to Cobo wallet (${COBO_WALLET}): ${coboMintReceipt.hash}`);

  // ── 6. Expert provider: mint + depositStake ────────────────────────────────
  // Deployer mints to expert address.
  await (await usdc.mint(expertAddress, PROVIDER_MINT)).wait();
  console.log(`Minted ${PROVIDER_MINT} (${Number(PROVIDER_MINT)/1e6} mUSDC) to expert provider ${expertAddress}`);

  // Expert provider approves ChallengeManager and deposits stake.
  // We connect the ERC-20 and ChallengeManager to the providerSigner.
  const usdcAsProvider = usdc.connect(providerSigner);
  const approveTx = await usdcAsProvider.approve(cmAddress, EXPERT_STAKE);
  await approveTx.wait();
  console.log("Expert provider approved ChallengeManager for stake transfer ✓");

  const cmAsProvider = cm.connect(providerSigner);
  const stakeTx = await cmAsProvider.depositStake(EXPERT_STAKE);
  const stakeReceipt = await stakeTx.wait();
  if (!stakeReceipt) throw new Error("depositStake tx receipt is null");
  console.log(`Expert provider deposited ${EXPERT_STAKE} stake: ${stakeReceipt.hash}`);

  // Verify stake on-chain.
  const expertStakeOnChain = await cm.stake(expertAddress);
  const hasMin = await cm.hasMinStake(expertAddress);
  console.log(`cm.stake(expert) = ${expertStakeOnChain}  hasMinStake = ${hasMin}`);
  if (!hasMin) throw new Error("Expert provider hasMinStake is false after depositStake — abort");

  // ── 7. Catalog-only providers: mint only (stake pending P1) ───────────────
  await (await usdc.mint(shallowAddress, PROVIDER_MINT)).wait();
  console.log(`Minted ${PROVIDER_MINT} to shallow provider ${shallowAddress} (stake pending P1)`);

  await (await usdc.mint(generalAddress, PROVIDER_MINT)).wait();
  console.log(`Minted ${PROVIDER_MINT} to general provider ${generalAddress} (stake pending P1)`);

  // ── 8. Challenger: mint deposit-worth of MockUSDC ─────────────────────────
  await (await usdc.mint(challengerAddress, CHALLENGER_MINT)).wait();
  console.log(`Minted ${CHALLENGER_MINT} to challenger ${challengerAddress}`);

  // ── 9. Write artifact ──────────────────────────────────────────────────────
  const network = await hre.ethers.provider.getNetwork();
  const block   = await hre.ethers.provider.getBlockNumber();

  const artifact = {
    chainId: Number(network.chainId),
    network: "sepolia",
    deployer: deployer.address,
    blockNumber: block,
    coboWallet: COBO_WALLET,
    contracts: {
      MockUSDC:                    usdcAddress,
      ProofMarketEscrow:           escrowAddress,
      ProofMarketChallengeManager: cmAddress
    },
    challengeManagerParams: {
      minStake:         MIN_STAKE.toString(),
      challengeDeposit: CHALLENGE_DEPOSIT.toString(),
      slashBps:         SLASH_BPS.toString(),
      slashRewardBps:   SLASH_REWARD_BPS.toString()
    },
    resolver:  resolverAddress,
    treasury:  treasuryAddress,
    challenger: {
      address:     challengerAddress,
      mintedUsdc:  CHALLENGER_MINT.toString()
    },
    providers: {
      "execution-research-expert": {
        address:     expertAddress,
        mintedUsdc:  PROVIDER_MINT.toString(),
        stakedAmount: EXPERT_STAKE.toString(),
        stakePending: false
      },
      "shallow-search-provider": {
        address:     shallowAddress,
        mintedUsdc:  PROVIDER_MINT.toString(),
        stakedAmount: "0",
        stakePending: true,
        stakePendingReason: "No private key held by deploy script; provider self-stakes in P1"
      },
      "general-web-summary": {
        address:     generalAddress,
        mintedUsdc:  PROVIDER_MINT.toString(),
        stakedAmount: "0",
        stakePending: true,
        stakePendingReason: "No private key held by deploy script; provider self-stakes in P1"
      }
    },
    mint: {
      to:        COBO_WALLET,
      rawAmount: MINT_TO_COBO.toString(),
      txHash:    coboMintReceipt.hash
    },
    deployedAt: new Date().toISOString()
  };

  const outDir = join(process.cwd(), "..", "..", "deployments");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "sepolia.json"), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log("Wrote deployments/sepolia.json");
  console.log("Done ✓");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
