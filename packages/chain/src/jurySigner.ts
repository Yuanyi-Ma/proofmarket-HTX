import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { challengeManagerAbi } from "./escrowAbi";
import { assertReceiptSuccess } from "./chainReader";

export type CastVoteOnChain = (input: {
  challengeId: bigint;
  /** ChallengeResult enum: 1 = ProviderFault, 2 = ProviderNotFault. */
  result: number;
  reasonHash: `0x${string}`;
}) => Promise<{ txHash: string }>;

/**
 * One juror's castVote signer. Each juror operator holds its own key — the
 * vote MUST come from the registered juror address, so these are direct
 * signers (like the provider submitter), never routed through Cobo.
 */
export function createJuryVoter(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
  challengeManagerAddress: `0x${string}`;
}): CastVoteOnChain {
  const account = privateKeyToAccount(input.privateKey);
  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async ({ challengeId, result, reasonHash }) => {
    const hash = await client.writeContract({
      address: input.challengeManagerAddress,
      abi: challengeManagerAbi,
      functionName: "castVote",
      args: [challengeId, result, reasonHash]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}

export type SubmitDefenseOnChain = (input: {
  challengeId: bigint;
  defenseHash: `0x${string}`;
}) => Promise<{ txHash: string }>;

/**
 * The challenged provider's defense filing. submitDefense is provider-only
 * on-chain, so it is signed with the provider submit key.
 */
export function createDefenseSubmitter(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
  challengeManagerAddress: `0x${string}`;
}): SubmitDefenseOnChain {
  const account = privateKeyToAccount(input.privateKey);
  const client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async ({ challengeId, defenseHash }) => {
    const hash = await client.writeContract({
      address: input.challengeManagerAddress,
      abi: challengeManagerAbi,
      functionName: "submitDefense",
      args: [challengeId, defenseHash]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 180_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}
