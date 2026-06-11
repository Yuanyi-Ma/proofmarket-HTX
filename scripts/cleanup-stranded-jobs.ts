/**
 * cleanup-stranded-jobs.ts — terminal-settle escrow jobs stranded by
 * interrupted demo runs, releasing their locked provider stake bonds.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/cleanup-stranded-jobs.ts complete <jobId>
 *   npx tsx --env-file=.env scripts/cleanup-stranded-jobs.ts expire <jobId>
 *
 * Both actions must be signed by the Cobo wallet (it is the job's client AND
 * evaluator), so the script submits a fresh pact and routes the call through
 * caw — same path as the app, no key shortcuts.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { createCliCoboClient } from "@proofmarket/cobo/src/coboClient";
import { buildRealPactSubmission } from "@proofmarket/cobo/src/pactPolicy";
import { encodeComplete, encodeExpireAndRefund } from "@proofmarket/chain/src/calldata";
import { escrowAbi } from "@proofmarket/chain/src/escrowAbi";
import { stableHash } from "@proofmarket/shared/src/hash";
import { parseDeploymentArtifact } from "@proofmarket/shared/src/realMode";

const JOB_STATE = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired", "Challenged"];

async function main() {
  const [action, jobIdArg] = process.argv.slice(2);
  if (!["complete", "expire"].includes(action) || !/^\d+$/.test(jobIdArg ?? "")) {
    throw new Error("usage: cleanup-stranded-jobs.ts <complete|expire> <jobId>");
  }
  const jobId = BigInt(jobIdArg);

  const artifact = parseDeploymentArtifact(
    JSON.parse(readFileSync(join(process.cwd(), "deployments", "sepolia.json"), "utf8"))
  );
  const escrowAddress = artifact.contracts.ProofMarketEscrow as `0x${string}`;
  const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL ?? "") });

  const readJob = () =>
    client.readContract({ address: escrowAddress, abi: escrowAbi, functionName: "jobs", args: [jobId] }) as Promise<readonly unknown[]>;

  const before = await readJob();
  console.log(`job ${jobId}: state=${JOB_STATE[Number(before[9])]} budget=${before[7]}`);

  const cobo = createCliCoboClient({ srcAddress: artifact.coboWallet });
  const pact = await cobo.submitPact(
    buildRealPactSubmission({
      escrowAddress,
      tokenAddress: artifact.contracts.MockUSDC,
      challengeManagerAddress: artifact.contracts.ProofMarketChallengeManager,
      budgetAmount: "1",
      taskId: `cleanup-job-${jobId}`
    })
  );
  console.log(`pact ${pact.pactId} status=${pact.status}`);

  const calldata =
    action === "complete"
      ? encodeComplete(jobId, stableHash({ cleanup: `job-${jobId}`, reason: "stranded by interrupted demo run" }) as `0x${string}`)
      : encodeExpireAndRefund(jobId);
  const call = await cobo.callContract({
    pactId: pact.pactId,
    contract: escrowAddress,
    calldata,
    requestId: `cleanup-${jobId}-${Date.now().toString(36)}`,
    description: `cleanup ${action} for stranded job ${jobId}`
  });
  console.log(`cobo tx ${call.coboTxId} status=${call.status}`);

  // The chain is the source of truth: poll the job state to terminal.
  const target = action === "complete" ? 3 : 5;
  for (let i = 0; i < 36; i++) {
    const job = await readJob();
    const state = Number(job[9]);
    if (state === target) {
      console.log(`job ${jobId} now ${JOB_STATE[state]} ✓ (stake bond released)`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`job ${jobId} did not reach ${JOB_STATE[target]} within 3 minutes — check the Cobo tx`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
