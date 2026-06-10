import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { challengeManagerAbi } from "./escrowAbi";
import { assertReceiptSuccess } from "./chainReader";

export type ResolveChallengeOnChain = (input: {
  challengeId: bigint;
  result: number;
}) => Promise<{ txHash: string }>;

/**
 * ChallengeManager.resolve is resolver-only on-chain: it is signed directly
 * with the backend's resolver key (like the provider submit signer), NOT
 * routed through Cobo — the Cobo wallet is the job client, not the resolver.
 */
export function createChallengeResolver(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
  challengeManagerAddress: `0x${string}`;
}): ResolveChallengeOnChain {
  const account = privateKeyToAccount(input.privateKey);
  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async ({ challengeId, result }) => {
    const hash = await client.writeContract({
      address: input.challengeManagerAddress,
      abi: challengeManagerAbi,
      functionName: "resolve",
      args: [challengeId, result]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}
