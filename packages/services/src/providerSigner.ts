import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { escrowAbi } from "@proofmarket/chain/src/escrowAbi";
import { assertReceiptSuccess } from "@proofmarket/chain/src/chainReader";
import { getViemChainByChainId } from "@proofmarket/chain/src/chains";
import type { SubmitOnChain } from "./server";

export function createProviderSubmitter(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
  escrowAddress: `0x${string}`;
  chainId?: number;
}): SubmitOnChain {
  const account = privateKeyToAccount(input.privateKey);
  const client = createWalletClient({
    account,
    chain: getViemChainByChainId(input.chainId),
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async ({ jobId, deliverableHash }) => {
    const hash = await client.writeContract({
      address: input.escrowAddress,
      abi: escrowAbi,
      functionName: "submit",
      args: [jobId, deliverableHash]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 420_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}
