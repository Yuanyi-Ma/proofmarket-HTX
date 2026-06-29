import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { challengeManagerAbi } from "./escrowAbi";
import { assertReceiptSuccess } from "./chainReader";
import { getViemChainByChainId } from "./chains";

export type ResolveChallengeOnChain = (input: {
  challengeId: bigint;
}) => Promise<{ txHash: string }>;

/**
 * ChallengeManager.resolve(challengeId) is permissionless in v2 — the outcome
 * is the on-chain juror-vote majority, so execution carries no discretion.
 * It is still signed directly with the backend's resolver key (NOT routed
 * through PolicySigner) because the PolicySigner wallet is the job client, and any key works.
 */
export function createChallengeResolver(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
  challengeManagerAddress: `0x${string}`;
  chainId?: number;
}): ResolveChallengeOnChain {
  const account = privateKeyToAccount(input.privateKey);
  const client = createWalletClient({
    account,
    chain: getViemChainByChainId(input.chainId),
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async ({ challengeId }) => {
    const hash = await client.writeContract({
      address: input.challengeManagerAddress,
      abi: challengeManagerAbi,
      functionName: "resolve",
      args: [challengeId]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 420_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}
