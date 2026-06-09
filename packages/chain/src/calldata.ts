import { encodeFunctionData } from "viem";
import { erc20Abi, escrowAbi } from "./escrowAbi";

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
