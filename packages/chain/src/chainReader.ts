import {
  AbiEventSignatureNotFoundError,
  createPublicClient,
  decodeEventLog,
  http,
  type Hash,
  type TransactionReceipt
} from "viem";
import { sepolia } from "viem/chains";
import { challengeManagerAbi, escrowAbi } from "./escrowAbi";

/**
 * A mined receipt is not a successful receipt: a reverted tx still mines.
 * Every receipt consumer must run this gate before treating the tx as confirmed.
 */
export function assertReceiptSuccess(
  receipt: Pick<TransactionReceipt, "status">,
  txHash: string
): void {
  if (receipt.status !== "success") {
    throw new Error(`transaction reverted on-chain: ${txHash}`);
  }
}

export type ChainReader = {
  waitForReceipt(txHash: Hash): Promise<TransactionReceipt>;
  extractJobId(receipt: TransactionReceipt, escrowAddress: string): bigint;
  extractChallengeId(receipt: TransactionReceipt, challengeManagerAddress: string): bigint;
  readJobState(escrowAddress: `0x${string}`, jobId: bigint): Promise<{ state: number; budget: bigint; deliverableHash: `0x${string}` }>;
};

export function createChainReader(rpcUrl: string): ChainReader {
  // Let viem infer the typed client — no explicit PublicClient annotation needed
  const client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

  return {
    async waitForReceipt(txHash) {
      const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 });
      assertReceiptSuccess(receipt, txHash);
      return receipt;
    },

    extractJobId(receipt, escrowAddress) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== escrowAddress.toLowerCase()) continue;
        try {
          const event = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics });
          if (event.eventName === "JobCreated") {
            return (event.args as { jobId: bigint }).jobId;
          }
          // Known event from escrow (e.g. JobFunded) but not JobCreated — skip
        } catch (error) {
          // Only swallow "topic0 not in ABI" — any other decode failure is unexpected and should surface
          if (!(error instanceof AbiEventSignatureNotFoundError)) throw error;
        }
      }
      throw new Error(`No JobCreated event found in receipt ${receipt.transactionHash}`);
    },

    extractChallengeId(receipt, challengeManagerAddress) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== challengeManagerAddress.toLowerCase()) continue;
        try {
          const event = decodeEventLog({ abi: challengeManagerAbi, data: log.data, topics: log.topics });
          if (event.eventName === "ChallengeOpened") {
            return (event.args as { challengeId: bigint }).challengeId;
          }
          // Known ChallengeManager event (e.g. StakeLocked) but not ChallengeOpened — skip
        } catch (error) {
          // Only swallow "topic0 not in ABI" — any other decode failure should surface
          if (!(error instanceof AbiEventSignatureNotFoundError)) throw error;
        }
      }
      throw new Error(`No ChallengeOpened event found in receipt ${receipt.transactionHash}`);
    },

    async readJobState(escrowAddress, jobId) {
      // viem infers a positional readonly tuple matching the jobs() ABI outputs:
      //   [0] jobId, [1] client, [2] providerAgentId, [3] provider,
      //   [4] verifierAgentId, [5] evaluator, [6] token,
      //   [7] budget (uint256), [8] expiredAt,
      //   [9] state (uint8) — JobState enum: 0 Open, 1 Funded, 2 Submitted,
      //                        3 Completed, 4 Rejected, 5 Expired, 6 Challenged
      //  [10] descriptionHash, [11] deliverableHash, [12] coverageHash
      const job = await client.readContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "jobs",
        args: [jobId]
      });
      return {
        state: Number(job[9]),   // index 9 → state (see Job struct comment above)
        budget: job[7],          // index 7 → budget
        deliverableHash: job[11] // index 11 → deliverableHash
      };
    }
  };
}
