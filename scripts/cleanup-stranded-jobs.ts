/**
 * cleanup-stranded-jobs.ts — terminal-settle escrow jobs stranded by
 * interrupted demo runs, releasing their locked provider stake bonds.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/cleanup-stranded-jobs.ts complete <jobId>
 *   npx tsx --env-file=.env scripts/cleanup-stranded-jobs.ts expire <jobId>
 *   npx tsx --env-file=.env scripts/cleanup-stranded-jobs.ts settle-open <jobId>
 *
 * Both actions must be signed by the restricted signer address (it is the job's
 * client AND evaluator), so the script submits a fresh policy and routes the
 * call through the same allowlist-enforced signer as the app.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { createLocalPolicySignerClient } from "@proofmarket/policy-signer/src/policySignerClient";
import { buildRealPolicySubmission } from "@proofmarket/policy-signer/src/policy";
import {
  encodeApprove,
  encodeComplete,
  encodeExpireAndRefund,
  encodeFund,
  encodeSetBudget
} from "@proofmarket/chain/src/calldata";
import { escrowAbi } from "@proofmarket/chain/src/escrowAbi";
import { assertReceiptSuccess } from "@proofmarket/chain/src/chainReader";
import { createProviderSubmitter } from "@proofmarket/services/src/providerSigner";
import { stableHash } from "@proofmarket/shared/src/hash";
import { parseDeploymentArtifact } from "@proofmarket/shared/src/realMode";

const JOB_STATE = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired", "Challenged"];

async function main() {
  const [action, jobIdArg] = process.argv.slice(2);
  if (!["complete", "expire", "settle-open"].includes(action) || !/^\d+$/.test(jobIdArg ?? "")) {
    throw new Error("usage: cleanup-stranded-jobs.ts <complete|expire|settle-open> <jobId>");
  }
  const jobId = BigInt(jobIdArg);

  const artifact = parseDeploymentArtifact(
    JSON.parse(readFileSync(join(process.cwd(), "deployments", "sepolia.json"), "utf8"))
  );
  const escrowAddress = artifact.contracts.ProofMarketEscrow as `0x${string}`;
  const client = createPublicClient({ chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL ?? "") });

  const readJob = () =>
    client.readContract({ address: escrowAddress, abi: escrowAbi, functionName: "jobs", args: [jobId] }) as Promise<readonly unknown[]>;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function extractTxHash(parsed: Record<string, unknown>): `0x${string}` | null {
    const candidate = parsed.tx_hash ?? parsed.transaction_hash;
    return typeof candidate === "string" && /^0x[0-9a-fA-F]{64}$/.test(candidate)
      ? candidate as `0x${string}`
      : null;
  }

  function isFailedTx(parsed: Record<string, unknown>): boolean {
    return (
      typeof parsed.status === "string" &&
      ["failed", "rejected", "denied", "cancelled", "canceled", "invalid"].includes(
        parsed.status.toLowerCase()
      )
    );
  }

  async function policySignerCallAndWait(input: {
    policyId: string;
    contract: `0x${string}`;
    calldata: `0x${string}`;
    requestId: string;
    description: string;
  }): Promise<`0x${string}`> {
    const call = await policySigner.callContract(input);
    console.log(`${input.description}: policySigner tx ${call.policySignerRequestId} status=${call.status}`);

    for (let i = 0; i < 84; i++) {
      const { parsed } = await policySigner.getTx(call.policySignerRequestId);
      if (isFailedTx(parsed)) {
        throw new Error(`${input.description} failed in restricted signer: ${JSON.stringify(parsed)}`);
      }
      const txHash = extractTxHash(parsed);
      if (txHash) {
        const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 420_000 });
        assertReceiptSuccess(receipt, txHash);
        console.log(`${input.description}: confirmed ${txHash}`);
        return txHash;
      }
      await sleep(5_000);
    }
    throw new Error(`${input.description} produced no tx hash after polling`);
  }

  const before = await readJob();
  console.log(`job ${jobId}: state=${JOB_STATE[Number(before[9])]} budget=${before[7]}`);

  const policySignerPrivateKey = process.env.POLICY_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!policySignerPrivateKey) throw new Error("POLICY_SIGNER_PRIVATE_KEY required");
  const policySigner = createLocalPolicySignerClient({
    rpcUrl: process.env.SEPOLIA_RPC_URL ?? "",
    privateKey: policySignerPrivateKey,
    srcAddress: artifact.policySignerAddress
  });
  const policy = await policySigner.submitPolicy(
    buildRealPolicySubmission({
      escrowAddress,
      tokenAddress: artifact.contracts.MockUSDC,
      challengeManagerAddress: artifact.contracts.ProofMarketChallengeManager,
      budgetAmount: "1",
      taskId: `cleanup-job-${jobId}`
    })
  );
  console.log(`policy ${policy.policyId} status=${policy.status}`);

  if (action === "settle-open") {
    const budget = BigInt(before[7] as bigint) > 0n ? before[7] as bigint : 1_000_000n;
    const budgetHuman = Number(budget) / 1e6;
    const suffix = `${jobId}-${Date.now().toString(36)}`;

    await policySignerCallAndWait({
      policyId: policy.policyId,
      contract: artifact.contracts.MockUSDC as `0x${string}`,
      calldata: encodeApprove(escrowAddress, budget),
      requestId: `cleanup-${suffix}-approve`,
      description: `cleanup approve ${budgetHuman} mUSDC for job ${jobId}`
    });

    let job = await readJob();
    if (Number(job[9]) === 0 && BigInt(job[7] as bigint) === 0n) {
      await policySignerCallAndWait({
        policyId: policy.policyId,
        contract: escrowAddress,
        calldata: encodeSetBudget(jobId, budget),
        requestId: `cleanup-${suffix}-setBudget`,
        description: `cleanup setBudget for job ${jobId}`
      });
      job = await readJob();
    }

    if (Number(job[9]) === 0) {
      await policySignerCallAndWait({
        policyId: policy.policyId,
        contract: escrowAddress,
        calldata: encodeFund(jobId, budget),
        requestId: `cleanup-${suffix}-fund`,
        description: `cleanup fund for job ${jobId}`
      });
      job = await readJob();
    }

    if (Number(job[9]) === 1) {
      const providerKey = process.env.PROVIDER_SIGNER_PRIVATE_KEY as `0x${string}` | undefined;
      if (!providerKey) throw new Error("PROVIDER_SIGNER_PRIVATE_KEY required for settle-open");
      const deliverableHash = stableHash({
        cleanup: `job-${jobId}`,
        reason: "complete open job left by interrupted demo run"
      }) as `0x${string}`;
      const submit = createProviderSubmitter({
        rpcUrl: process.env.SEPOLIA_RPC_URL ?? "",
        privateKey: providerKey,
        escrowAddress
      });
      const submitted = await submit({ jobId, deliverableHash });
      console.log(`cleanup submit for job ${jobId}: confirmed ${submitted.txHash}`);
      job = await readJob();
    }

    if (Number(job[9]) !== 2) {
      throw new Error(`job ${jobId} is ${JOB_STATE[Number(job[9])]}, expected Submitted before complete`);
    }

    await policySignerCallAndWait({
      policyId: policy.policyId,
      contract: escrowAddress,
      calldata: encodeComplete(
        jobId,
        stableHash({ cleanup: `job-${jobId}`, reason: "client accepts no challenge" }) as `0x${string}`
      ),
      requestId: `cleanup-${suffix}-complete`,
      description: `cleanup complete for job ${jobId}`
    });
    const after = await readJob();
    console.log(`job ${jobId} now ${JOB_STATE[Number(after[9])]} ✓ (stake bond released)`);
    return;
  }

  const calldata =
    action === "complete"
      ? encodeComplete(jobId, stableHash({ cleanup: `job-${jobId}`, reason: "stranded by interrupted demo run" }) as `0x${string}`)
      : encodeExpireAndRefund(jobId);
  const call = await policySigner.callContract({
    policyId: policy.policyId,
    contract: escrowAddress,
    calldata,
    requestId: `cleanup-${jobId}-${Date.now().toString(36)}`,
    description: `cleanup ${action} for stranded job ${jobId}`
  });
  console.log(`policySigner tx ${call.policySignerRequestId} status=${call.status}`);

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
  throw new Error(`job ${jobId} did not reach ${JOB_STATE[target]} within 3 minutes — check the restricted signer tx`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
