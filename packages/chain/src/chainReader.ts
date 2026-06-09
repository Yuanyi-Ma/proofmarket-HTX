import {
  createPublicClient,
  decodeEventLog,
  http,
  type Hash,
  type PublicClient,
  type TransactionReceipt
} from "viem";
import { sepolia } from "viem/chains";
import { escrowAbi } from "./escrowAbi";

export type ChainReader = {
  waitForReceipt(txHash: Hash): Promise<TransactionReceipt>;
  extractJobId(receipt: TransactionReceipt, escrowAddress: string): bigint;
  readJobState(escrowAddress: `0x${string}`, jobId: bigint): Promise<{ state: number; budget: bigint; deliverableHash: `0x${string}` }>;
};

export function createChainReader(rpcUrl: string): ChainReader {
  const client: PublicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

  return {
    async waitForReceipt(txHash) {
      return client.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 });
    },

    extractJobId(receipt, escrowAddress) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== escrowAddress.toLowerCase()) continue;
        try {
          const event = decodeEventLog({ abi: escrowAbi, data: log.data, topics: log.topics });
          if (event.eventName === "JobCreated") {
            return (event.args as { jobId: bigint }).jobId;
          }
        } catch {
          /* not a JobCreated log */
        }
      }
      throw new Error(`No JobCreated event found in receipt ${receipt.transactionHash}`);
    },

    async readJobState(escrowAddress, jobId) {
      const job = (await client.readContract({
        address: escrowAddress,
        abi: escrowAbi,
        functionName: "jobs",
        args: [jobId]
      })) as readonly unknown[];
      return {
        state: Number(job[9]),
        budget: job[7] as bigint,
        deliverableHash: job[11] as `0x${string}`
      };
    }
  };
}
