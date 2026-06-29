/**
 * register-jurors-injective.ts
 *
 * Seats the preset 3-juror panel on the existing Injective deployment and
 * updates deployments/injective.json. Safe to re-run: already-registered jurors
 * are detected from jurorCount/jurorList and skipped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { presetJurorIdentities } from "../../shared/src/jurors.ts";
import hre from "hardhat";

const JUROR_GAS_WEI = 20_000_000_000_000_000n; // 0.02 INJ

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

  const artifactPath = join(process.cwd(), "..", "..", "deployments", "injective.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const cmAddress = artifact.contracts?.ProofMarketChallengeManager;
  if (!/^0x[0-9a-fA-F]{40}$/.test(cmAddress ?? "")) {
    throw new Error("deployments/injective.json missing contracts.ProofMarketChallengeManager");
  }

  const jurorAddresses = presetJurorIdentities.map((_, index) => {
    const envName = jurorEnvName(index);
    const address = process.env[envName] ?? "";
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`${envName} must be a 42-char 0x address`);
    }
    return address;
  });

  const [deployer] = await hre.ethers.getSigners();
  const cm = await hre.ethers.getContractAt("ProofMarketChallengeManager", cmAddress);
  const jurySize = await cm.jurySize();
  let count = await cm.jurorCount();
  console.log(`ChallengeManager: ${cmAddress}`);
  console.log(`Before: jurorCount=${count} jurySize=${jurySize}`);

  for (const [index, juror] of presetJurorIdentities.entries()) {
    const address = jurorAddresses[index];
    const registered = await cm.jurors(address);
    if (registered.registered) {
      console.log(`Already registered ${juror.jurorId} @ ${address}`);
      continue;
    }
    const modelHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(juror.modelTag));
    const promptHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(juror.promptTag));
    await (await cm.registerJuror(address, modelHash, promptHash)).wait();
    console.log(`Registered ${juror.jurorId} @ ${address}`);
  }

  count = await cm.jurorCount();
  if (count !== jurySize) {
    throw new Error(`jury not fully seated: jurorCount=${count} jurySize=${jurySize}`);
  }

  for (const [index, address] of jurorAddresses.entries()) {
    const balance = await hre.ethers.provider.getBalance(address);
    if (balance >= JUROR_GAS_WEI) {
      console.log(`Juror ${index + 1} gas OK: ${hre.ethers.formatEther(balance)} INJ`);
      continue;
    }
    await (await deployer.sendTransaction({ to: address, value: JUROR_GAS_WEI - balance })).wait();
    console.log(`Funded juror ${index + 1} to ${hre.ethers.formatEther(JUROR_GAS_WEI)} INJ`);
  }

  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const nextArtifact = {
    ...artifact,
    blockNumber,
    jurors: presetJurorIdentities.map((juror, index) => ({
      jurorId: juror.jurorId,
      address: jurorAddresses[index],
      modelFamily: juror.modelFamily,
      modelTag: juror.modelTag,
      promptTag: juror.promptTag
    })),
    deployedAt: new Date().toISOString()
  };
  writeFileSync(artifactPath, `${JSON.stringify(nextArtifact, null, 2)}\n`);
  console.log("Updated deployments/injective.json");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
