/**
 * upgrade-jury-sepolia.ts — v2 (AI 审判团) redeploy.
 *
 * Reuses the already-deployed MockUSDC and the ERC-8004 registrations from the
 * existing deployments/sepolia.json; deploys ONLY the v2 Escrow (with the W_c
 * challenge-window gate) and the v2 ChallengeManager (jury fee F, 3-seat
 * voting, defense window R_w), then:
 *   1. wires the pair,
 *   2. registers the 3 preset jury operators (model/prompt hash commitments),
 *   3. funds each juror address with gas SETH,
 *   4. re-stakes the expert provider on the NEW manager (fresh mint),
 *   5. tops up the restricted signer address with mUSDC for challenge deposits (D + F),
 *   6. rewrites deployments/sepolia.json preserving erc8004/provider identity.
 *
 * Run:
 *   pnpm --filter @proofmarket/contracts exec \
 *     hardhat run scripts/upgrade-jury-sepolia.ts --network sepolia
 * (env loaded from repo .env: SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY,
 *  PROVIDER_SIGNER_PRIVATE_KEY, JUROR{1,2,3}_ADDRESS)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import hre from "hardhat";

// ── v2 parameters (design doc §9 demo values) ────────────────────────────────
const MIN_STAKE         = 10_000_000n; // 10 mUSDC
const CHALLENGE_DEPOSIT =  2_000_000n; //  2 mUSDC (D)
const SLASH_BPS         =      5_000n; // 50 % → S = 5
const SLASH_REWARD_BPS  =      5_000n; // 50 % of S → R = 2.5
const JURY_FEE          =    500_000n; // 0.5 mUSDC (F)
const DEFENSE_WINDOW    =        120n; // R_w seconds
const JURY_SIZE         =          3n; // N
const CHALLENGE_WINDOW  =        300n; // W_c seconds (escrow)

const EXPERT_MINT_AND_STAKE = 40_000_000n; // 4 concurrent bonds of headroom
const POLICY_SIGNER_TOPUP   = 20_000_000n; // covers 8 challenge runs of D + F
const JUROR_GAS_WEI         = 20_000_000_000_000_000n; // 0.02 SETH each

// Jury operator identities. Tags MUST stay in sync with presetJurors in
// packages/shared/src/fixtures.ts — the UI shows the tags, the chain stores
// keccak256(tag) as the registration commitment.
const JURORS = [
  { jurorId: "juror-anthropic", modelFamily: "Anthropic Claude 系", modelTag: "claude-sonnet-4-6", promptTag: "proofmarket-jury-prompt-v1", env: "JUROR1_ADDRESS" },
  { jurorId: "juror-openai",    modelFamily: "OpenAI GPT 系",       modelTag: "gpt-5",             promptTag: "proofmarket-jury-prompt-v1", env: "JUROR2_ADDRESS" },
  { jurorId: "juror-google",    modelFamily: "Google Gemini 系",    modelTag: "gemini-2.5-pro",    promptTag: "proofmarket-jury-prompt-v1", env: "JUROR3_ADDRESS" }
] as const;

async function main() {
  if (!process.env.SEPOLIA_RPC_URL)      throw new Error("SEPOLIA_RPC_URL not set");
  if (!process.env.DEPLOYER_PRIVATE_KEY) throw new Error("DEPLOYER_PRIVATE_KEY not set");

  const artifactPath = join(process.cwd(), "..", "..", "deployments", "sepolia.json");
  const previous = JSON.parse(readFileSync(artifactPath, "utf8"));
  const usdcAddress: string = previous.contracts.MockUSDC;
  const policySignerAddress: string = previous.policySignerAddress;
  if (!usdcAddress || !policySignerAddress) {
    throw new Error("previous artifact missing MockUSDC/policySignerAddress");
  }

  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];
  const providerSigner = signers[1];
  if (!providerSigner) throw new Error("PROVIDER_SIGNER_PRIVATE_KEY required (signers[1])");

  const jurorAddresses = JURORS.map((juror) => {
    const address = process.env[juror.env] ?? "";
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error(`${juror.env} not set`);
    return address;
  });

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Reusing MockUSDC: ${usdcAddress}`);
  console.log(`Jurors: ${jurorAddresses.join(", ")}`);

  const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);

  // ── 1. Deploy v2 contracts ─────────────────────────────────────────────────
  const escrow = await hre.ethers.deployContract("ProofMarketEscrow", [CHALLENGE_WINDOW]);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`ProofMarketEscrow v2 (W_c=${CHALLENGE_WINDOW}s): ${escrowAddress}`);

  const cm = await hre.ethers.deployContract("ProofMarketChallengeManager", [
    usdcAddress,
    deployer.address, // treasury
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
  console.log(`ProofMarketChallengeManager v2: ${cmAddress}`);

  // ── 2. Wire ────────────────────────────────────────────────────────────────
  await (await escrow.setChallengeManager(cmAddress)).wait();
  await (await cm.setEscrow(escrowAddress)).wait();
  console.log("Wired escrow <-> challenge manager ✓");

  // ── 3. Register jury operators ─────────────────────────────────────────────
  for (const [i, juror] of JURORS.entries()) {
    const modelHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(juror.modelTag));
    const promptHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(juror.promptTag));
    await (await cm.registerJuror(jurorAddresses[i], modelHash, promptHash)).wait();
    console.log(`Registered ${juror.jurorId} (${juror.modelFamily}) @ ${jurorAddresses[i]} ✓`);
  }
  if ((await cm.jurorCount()) !== JURY_SIZE) throw new Error("jury not fully seated — abort");

  // ── 4. Fund jurors with gas ────────────────────────────────────────────────
  for (const [i, address] of jurorAddresses.entries()) {
    const balance = await hre.ethers.provider.getBalance(address);
    if (balance >= JUROR_GAS_WEI) {
      console.log(`Juror ${i + 1} already has gas (${hre.ethers.formatEther(balance)} SETH)`);
      continue;
    }
    await (await deployer.sendTransaction({ to: address, value: JUROR_GAS_WEI - balance })).wait();
    console.log(`Funded juror ${i + 1} with gas → ${hre.ethers.formatEther(JUROR_GAS_WEI)} SETH`);
  }

  // ── 5. Expert provider re-stake on the NEW manager ────────────────────────
  await (await usdc.mint(providerSigner.address, EXPERT_MINT_AND_STAKE)).wait();
  await (await usdc.connect(providerSigner).approve(cmAddress, EXPERT_MINT_AND_STAKE)).wait();
  await (await cm.connect(providerSigner).depositStake(EXPERT_MINT_AND_STAKE)).wait();
  const staked = await cm.stake(providerSigner.address);
  console.log(`Expert provider staked ${staked} on v2 manager (hasMinStake=${await cm.hasMinStake(providerSigner.address)})`);
  if (staked < MIN_STAKE) throw new Error("expert stake below minStake — abort");

  // ── 6. Restricted signer mUSDC top-up (challenge D + F) ──────────────────
  const topupTx = await usdc.mint(policySignerAddress, POLICY_SIGNER_TOPUP);
  const topupReceipt = await topupTx.wait();
  console.log(`Topped up restricted signer with ${Number(POLICY_SIGNER_TOPUP) / 1e6} mUSDC: ${topupReceipt?.hash}`);

  // ── 7. Rewrite artifact, preserving identity/erc8004 sections ─────────────
  const block = await hre.ethers.provider.getBlockNumber();
  const artifact = {
    ...previous,
    policySignerAddress,
    blockNumber: block,
    contracts: {
      ...previous.contracts,
      ProofMarketEscrow: escrowAddress,
      ProofMarketChallengeManager: cmAddress
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
    jurors: JURORS.map((juror, i) => ({
      jurorId: juror.jurorId,
      address: jurorAddresses[i],
      modelFamily: juror.modelFamily,
      modelTag: juror.modelTag,
      promptTag: juror.promptTag
    })),
    treasury: deployer.address,
    providers: {
      ...previous.providers,
      "execution-research-expert": {
        ...previous.providers?.["execution-research-expert"],
        stakedAmount: staked.toString(),
        stakePending: false
      }
    },
    deployedAt: new Date().toISOString()
  };
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log("Rewrote deployments/sepolia.json ✓");
  console.log("Done ✓");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
