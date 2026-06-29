import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { challengeManagerAbi } from "./escrowAbi";
import { assertReceiptSuccess } from "./chainReader";
import { getViemChainByChainId } from "./chains";

export type CastVoteOnChain = (input: {
  challengeId: bigint;
  /** ChallengeResult enum: 1 = ProviderFault, 2 = ProviderNotFault. */
  result: number;
  reasonHash: `0x${string}`;
}) => Promise<{ txHash: string }>;

/**
 * One juror's castVote signer. Each juror operator holds its own key — the
 * vote MUST come from the registered juror address, so these are direct
 * signers (like the provider submitter), never routed through PolicySigner.
 */
export function createJuryVoter(input: {
  rpcUrl: string;
  privateKey: `0x${string}`;
  challengeManagerAddress: `0x${string}`;
  chainId?: number;
}): CastVoteOnChain {
  const account = privateKeyToAccount(input.privateKey);
  const client = createWalletClient({
    account,
    chain: getViemChainByChainId(input.chainId),
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async ({ challengeId, result, reasonHash }) => {
    const hash = await client.writeContract({
      address: input.challengeManagerAddress,
      abi: challengeManagerAbi,
      functionName: "castVote",
      args: [challengeId, result, reasonHash]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 420_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}

export type DefenseWindowRemaining = (challengeId: bigint) => Promise<number>;

/**
 * Seconds of defense window R_w still open for a challenge, measured ENTIRELY
 * in chain time (latest block timestamp vs the challenge's on-chain openedAt).
 * Wall clocks must not be trusted here: block timestamps may run ahead of the
 * local clock, and castVote reverts with "defense window open" until the
 * window has passed in the contract's own clock domain.
 */
export function createDefenseWindowChecker(input: {
  rpcUrl: string;
  challengeManagerAddress: `0x${string}`;
  chainId?: number;
}): DefenseWindowRemaining {
  const client = createWalletClient({
    chain: getViemChainByChainId(input.chainId),
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async (challengeId) => {
    const [challenge, defenseWindow, block] = await Promise.all([
      client.readContract({
        address: input.challengeManagerAddress,
        abi: challengeManagerAbi,
        functionName: "challenges",
        args: [challengeId]
      }) as Promise<readonly unknown[]>,
      client.readContract({
        address: input.challengeManagerAddress,
        abi: challengeManagerAbi,
        functionName: "defenseWindow"
      }) as Promise<bigint>,
      client.getBlock()
    ]);
    const openedAt = challenge[7] as bigint; // struct field: openedAt
    const closesAt = openedAt + defenseWindow;
    return block.timestamp >= closesAt ? 0 : Number(closesAt - block.timestamp);
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
  chainId?: number;
}): SubmitDefenseOnChain {
  const account = privateKeyToAccount(input.privateKey);
  const client = createWalletClient({
    account,
    chain: getViemChainByChainId(input.chainId),
    transport: http(input.rpcUrl)
  }).extend(publicActions);

  return async ({ challengeId, defenseHash }) => {
    const hash = await client.writeContract({
      address: input.challengeManagerAddress,
      abi: challengeManagerAbi,
      functionName: "submitDefense",
      args: [challengeId, defenseHash]
    });
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 420_000 });
    assertReceiptSuccess(receipt, hash);
    return { txHash: hash };
  };
}
