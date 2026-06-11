import { encodeFunctionData } from "viem";
import { challengeManagerAbi, erc20Abi, escrowAbi } from "./escrowAbi";

type Hex = `0x${string}`;

export function encodeApprove(spender: Hex, amount: bigint): Hex {
  return encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

export function encodeCreateJob(args: {
  providerAgentId: bigint;
  provider: Hex;
  verifierAgentId: bigint;
  evaluator: Hex;
  token: Hex;
  expiredAt: bigint;
  descriptionHash: Hex;
  coverageHash: Hex;
}): Hex {
  return encodeFunctionData({
    abi: escrowAbi,
    functionName: "createJob",
    args: [
      args.providerAgentId,
      args.provider,
      args.verifierAgentId,
      args.evaluator,
      args.token,
      args.expiredAt,
      args.descriptionHash,
      args.coverageHash
    ]
  });
}

export function encodeSetBudget(jobId: bigint, amount: bigint): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "setBudget", args: [jobId, amount] });
}

export function encodeFund(jobId: bigint, expectedAmount: bigint): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "fund", args: [jobId, expectedAmount] });
}

export function encodeSubmit(jobId: bigint, deliverableHash: Hex): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "submit", args: [jobId, deliverableHash] });
}

export function encodeComplete(jobId: bigint, reasonHash: Hex): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "complete", args: [jobId, reasonHash] });
}

// ── Escrow: reject ────────────────────────────────────────────────────────────

export function encodeReject(jobId: bigint, reasonHash: Hex): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "reject", args: [jobId, reasonHash] });
}

// ── Escrow: P0 challenge-lifecycle functions ───────────────────────────────────

export function encodeMarkChallenged(jobId: bigint): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "markChallenged", args: [jobId] });
}

export function encodeRefundForChallenge(jobId: bigint): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "refundForChallenge", args: [jobId] });
}

export function encodeUnfreezeForChallenge(jobId: bigint): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "unfreezeForChallenge", args: [jobId] });
}

export function encodeSetChallengeManager(addr: Hex): Hex {
  return encodeFunctionData({ abi: escrowAbi, functionName: "setChallengeManager", args: [addr] });
}

// ── ChallengeManager: enum maps ───────────────────────────────────────────────
//
// Values are uint8 indices matching the Solidity enum declaration order.
// Read from ProofMarketChallengeManager.sol — do not reorder.

/**
 * ChallengeType enum (uint8).
 * Matches: enum ChallengeType { SourceNotFound, LocatorInvalid, ExcerptMismatch, NumericMismatch, CoverageMiss }
 */
export const ChallengeType = {
  SourceNotFound:  0,
  LocatorInvalid:  1,
  ExcerptMismatch: 2,
  NumericMismatch: 3,
  CoverageMiss:    4,
} as const;
export type ChallengeType = typeof ChallengeType[keyof typeof ChallengeType];

/**
 * ChallengeResult enum (uint8).
 * Matches: enum ChallengeResult { Pending, ProviderFault, ProviderNotFault }
 */
export const ChallengeResult = {
  Pending:          0,
  ProviderFault:    1,
  ProviderNotFault: 2,
} as const;
export type ChallengeResult = typeof ChallengeResult[keyof typeof ChallengeResult];

// ── ChallengeManager: stake management ───────────────────────────────────────

export function encodeDepositStake(amount: bigint): Hex {
  return encodeFunctionData({ abi: challengeManagerAbi, functionName: "depositStake", args: [amount] });
}

export function encodeWithdrawStake(amount: bigint): Hex {
  return encodeFunctionData({ abi: challengeManagerAbi, functionName: "withdrawStake", args: [amount] });
}

// ── ChallengeManager: escrow hooks ────────────────────────────────────────────

export function encodeLockStakeForJob(provider: Hex): Hex {
  return encodeFunctionData({ abi: challengeManagerAbi, functionName: "lockStakeForJob", args: [provider] });
}

export function encodeUnlockStakeForJob(provider: Hex): Hex {
  return encodeFunctionData({ abi: challengeManagerAbi, functionName: "unlockStakeForJob", args: [provider] });
}

// ── ChallengeManager: challenge lifecycle ─────────────────────────────────────
//
// challengeType accepts a number (0–4) or the ChallengeType enum values above.
// result accepts a number (1–2; 0=Pending is not a valid resolution) or ChallengeResult.

export function encodeOpenChallenge(jobId: bigint, challengeType: number, challengeHash: Hex): Hex {
  return encodeFunctionData({
    abi: challengeManagerAbi,
    functionName: "openChallenge",
    args: [jobId, challengeType, challengeHash]
  });
}

// resolve(challengeId) is single-arg in v2: the outcome is the on-chain
// majority of juror votes, never a caller-supplied result.
export function encodeResolve(challengeId: bigint): Hex {
  return encodeFunctionData({
    abi: challengeManagerAbi,
    functionName: "resolve",
    args: [challengeId]
  });
}

export function encodeSubmitDefense(challengeId: bigint, defenseHash: Hex): Hex {
  return encodeFunctionData({
    abi: challengeManagerAbi,
    functionName: "submitDefense",
    args: [challengeId, defenseHash]
  });
}

export function encodeCastVote(challengeId: bigint, result: number, reasonHash: Hex): Hex {
  return encodeFunctionData({
    abi: challengeManagerAbi,
    functionName: "castVote",
    args: [challengeId, result, reasonHash]
  });
}
