import { createHash } from "node:crypto";
import { createWalletClient, defineChain, http, type Address, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  getProofMarketNetworkByChainId,
  SEPOLIA_CHAIN_ID
} from "@proofmarket/shared/src/chains";

import type { RealPolicySubmission } from "./policy";

export type PolicySignerClientOptions = {
  rpcUrl?: string;
  privateKey?: `0x${string}`;
  // Backwards-compatible alias for the wallet address used by the real service.
  srcAddress?: string;
  signerAddress?: string;
  chainId?: number;
  dryRun?: boolean;
  now?: () => number;
};

export type PolicySubmitResult = { policyId: string; status: string; raw: string };
export type PolicyStatusResult = { policyId: string; status: string; raw: string };
export type ContractCallResult = { policySignerRequestId: string; status: string; raw: string };
export type DenialResult = {
  denied: true;
  exitCode: number;
  attemptedAction: string;
  rawOutput: string;
};

export interface PolicySignerClient {
  submitPolicy(submission: RealPolicySubmission): Promise<PolicySubmitResult>;
  getPolicyStatus(policyId: string): Promise<PolicyStatusResult>;
  callContract(input: {
    policyId: string;
    contract: string;
    calldata: string;
    requestId: string;
    description: string;
  }): Promise<ContractCallResult>;
  getTx(policySignerRequestId: string): Promise<{ raw: string; parsed: Record<string, unknown> }>;
  attemptDeniedTransfer(input: {
    policyId: string;
    dstAddress: string;
    amount: string;
  }): Promise<DenialResult>;
}

type StoredPolicy = {
  policyId: string;
  status: "active" | "expired";
  allowedTargets: Set<string>;
  maxTxCount: number;
  expiresAtMs: number | null;
  txCount: number;
  submittedRaw: string;
};

type StoredTx = {
  requestId: string;
  policyId: string;
  txHash: `0x${string}`;
  description: string;
  status: "submitted";
};

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function stableHex(input: unknown): `0x${string}` {
  return `0x${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

function pickMaxTxCount(submission: RealPolicySubmission): number {
  const policyLimit =
    submission.policies[0]?.rules.deny_if.usage_limits.rolling_24h.tx_count_gt;
  const completionLimit = submission.completionConditions.find(
    (condition) => condition.type === "tx_count"
  )?.threshold;
  const parsedCompletionLimit = completionLimit ? Number(completionLimit) : NaN;
  return Number.isFinite(parsedCompletionLimit) && parsedCompletionLimit > 0
    ? parsedCompletionLimit
    : policyLimit;
}

function pickExpiryMs(submission: RealPolicySubmission, nowMs: number): number | null {
  const expiry = submission.completionConditions.find(
    (condition) => condition.type === "time_elapsed"
  )?.threshold;
  if (!expiry) return null;
  const seconds = Number(expiry);
  return Number.isFinite(seconds) && seconds > 0 ? nowMs + seconds * 1000 : null;
}

function buildStoredPolicy(policyId: string, submission: RealPolicySubmission, nowMs: number): StoredPolicy {
  return {
    policyId,
    status: "active",
    allowedTargets: new Set(
      submission.policies.flatMap((policy) =>
        policy.rules.when.target_in.map((target) => normalizeAddress(target.contract_addr))
      )
    ),
    maxTxCount: pickMaxTxCount(submission),
    expiresAtMs: pickExpiryMs(submission, nowMs),
    txCount: 0,
    submittedRaw: JSON.stringify(submission)
  };
}

function viemChainForChainId(chainId: number): Chain {
  const network = getProofMarketNetworkByChainId(chainId);
  if (network.chainId === SEPOLIA_CHAIN_ID) {
    return sepolia;
  }
  return defineChain({
    id: network.chainId,
    name: network.chainName,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: {
      default: { http: [network.defaultRpcUrl] }
    },
    blockExplorers: {
      default: {
        name: "Blockscout",
        url: network.explorerBaseUrl
      }
    }
  });
}

function assertHexCalldata(calldata: string): asserts calldata is Hex {
  if (!/^0x[0-9a-fA-F]*$/.test(calldata)) {
    throw new Error("policy signer refused to sign: calldata must be a 0x hex string");
  }
}

function assertHexAddress(address: string): asserts address is Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`policy signer refused to sign: invalid target address ${address}`);
  }
}

export function createLocalPolicySignerClient(options: PolicySignerClientOptions = {}): PolicySignerClient {
  const policies = new Map<string, StoredPolicy>();
  const txs = new Map<string, StoredTx>();
  let counter = 0;
  const now = options.now ?? (() => Date.now());
  const network = getProofMarketNetworkByChainId(options.chainId ?? SEPOLIA_CHAIN_ID);
  const nativeAssetSymbol = network.chainId === SEPOLIA_CHAIN_ID
    ? "SETH"
    : network.nativeCurrency.symbol;
  const account = options.privateKey ? privateKeyToAccount(options.privateKey) : null;
  const expectedAddress = options.signerAddress ?? options.srcAddress;
  if (account && expectedAddress && normalizeAddress(account.address) !== normalizeAddress(expectedAddress)) {
    throw new Error(
      `POLICY_SIGNER_PRIVATE_KEY does not match configured signer address ${expectedAddress}`
    );
  }
  const walletClient = account
    ? createWalletClient({
        account,
        chain: viemChainForChainId(network.chainId),
        transport: http(options.rpcUrl)
      })
    : null;

  function getPolicy(policyId: string): StoredPolicy {
    const policy = policies.get(policyId);
    if (!policy) throw new Error(`policy signer refused to sign: unknown policy ${policyId}`);
    if (policy.expiresAtMs !== null && now() > policy.expiresAtMs) {
      policy.status = "expired";
      throw new Error(`policy signer refused to sign: policy ${policyId} expired`);
    }
    return policy;
  }

  function assertPolicyAllows(policy: StoredPolicy, contract: string): void {
    if (policy.status !== "active") {
      throw new Error(`policy signer refused to sign: policy ${policy.policyId} is ${policy.status}`);
    }
    if (!policy.allowedTargets.has(normalizeAddress(contract))) {
      throw new Error(
        `policy signer refused to sign: target ${contract} is outside the policy allowlist`
      );
    }
    if (policy.txCount >= policy.maxTxCount) {
      throw new Error(
        `policy signer refused to sign: policy ${policy.policyId} reached ${policy.maxTxCount} transactions`
      );
    }
  }

  async function sendAllowedTransaction(input: {
    requestId: string;
    policyId: string;
    contract: string;
    calldata: string;
    description: string;
  }): Promise<StoredTx> {
    assertHexAddress(input.contract);
    assertHexCalldata(input.calldata);
    const policy = getPolicy(input.policyId);
    assertPolicyAllows(policy, input.contract);

    const txHash = walletClient
      ? await walletClient.sendTransaction({
          to: input.contract,
          data: input.calldata,
          value: 0n
        })
      : stableHex({
          requestId: input.requestId,
          policyId: input.policyId,
          contract: normalizeAddress(input.contract),
          calldata: input.calldata,
          dryRun: true
        });

    policy.txCount += 1;
    const tx: StoredTx = {
      requestId: input.requestId,
      policyId: input.policyId,
      txHash,
      description: input.description,
      status: "submitted"
    };
    txs.set(input.requestId, tx);
    return tx;
  }

  return {
    async submitPolicy(submission) {
      counter += 1;
      const policyId = `policy_${counter.toString().padStart(3, "0")}`;
      const policy = buildStoredPolicy(policyId, submission, now());
      policies.set(policyId, policy);
      return {
        policyId,
        status: "active",
        raw: JSON.stringify({
          policyId,
          status: "active",
          signer: account?.address ?? expectedAddress ?? "dry-run",
          chainId: network.chainId,
          chainName: network.chainName,
          allowedTargets: [...policy.allowedTargets],
          maxTxCount: policy.maxTxCount,
          expiresAtMs: policy.expiresAtMs
        })
      };
    },

    async getPolicyStatus(policyId) {
      const policy = policies.get(policyId);
      if (!policy) {
        return {
          policyId,
          status: "unknown",
          raw: JSON.stringify({ policyId, status: "unknown" })
        };
      }
      if (policy.expiresAtMs !== null && now() > policy.expiresAtMs) {
        policy.status = "expired";
      }
      return {
        policyId,
        status: policy.status,
        raw: JSON.stringify({
          policyId,
          status: policy.status,
          txCount: policy.txCount,
          maxTxCount: policy.maxTxCount
        })
      };
    },

    async callContract(input) {
      const tx = await sendAllowedTransaction(input);
      return {
        policySignerRequestId: input.requestId,
        status: tx.status,
        raw: JSON.stringify({
          requestId: input.requestId,
          policyId: input.policyId,
          status: tx.status,
          transaction_hash: tx.txHash
        })
      };
    },

    async getTx(policySignerRequestId) {
      const tx = txs.get(policySignerRequestId);
      if (!tx) {
        return {
          raw: JSON.stringify({ request_id: policySignerRequestId, status: "unknown" }),
          parsed: { request_id: policySignerRequestId, status: "unknown" }
        };
      }
      const parsed = {
        request_id: tx.requestId,
        policy_id: tx.policyId,
        status: tx.status,
        description: tx.description,
        transaction_hash: tx.txHash,
        tx_hash: tx.txHash
      };
      return { raw: JSON.stringify(parsed), parsed };
    },

    async attemptDeniedTransfer(input) {
      getPolicy(input.policyId);
      return {
        denied: true,
        exitCode: 403,
        attemptedAction: `tx transfer ${input.amount} ${nativeAssetSymbol} -> ${input.dstAddress}`,
        rawOutput:
          "POLICY_SIGNER_DENY: direct transfer refused before signing; no transfer policy matched " +
          `policy=${input.policyId}, dst=${input.dstAddress}, amount=${input.amount}`
      };
    }
  };
}
