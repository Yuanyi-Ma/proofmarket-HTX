import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { challengeManagerAbi } from "./escrowAbi";
import { assertReceiptSuccess } from "./chainReader";

export type ResolveChallengeOnChain = (input: {
  challengeId: bigint;
}) => Promise<{ txHash: string }>;

/**
 * ChallengeManager.resolve(challengeId) is permissionless in v2 — the outcome
 * is the on-chain juror-vote majority, so execution carries no discretion.
 * It is still signed directly with the backend's resolver key (NOT routed
 * through Cobo) because the Cobo wallet is the job client, and any key works.
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

  return async ({ challengeId }) => {
    const hash = await client.writeContract({
      address: input.challengeManagerAddress,
      abi: challengeManagerAbi,
      functionName: "resolve",
      args: [challengeId]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}
