// Fixture-mode types — intentionally separate from the real CLI client types
// so the fixture interface is stable regardless of CLI changes.

export type FixturePolicySubmission = {
  policyId: string;
  status: "submitted" | "active" | "denied" | "expired";
};

export type FixturePolicyStatus = {
  policyId: string;
  status: "submitted" | "active" | "denied" | "expired";
};

export type FixtureContractCallResult = {
  txHash: string;
  status: "submitted";
};

export type FixtureDeniedTransferResult = {
  denied: boolean;
  reason: string;
  attemptedTarget: string;
  attemptedFunction: string;
  attemptedAmount: string;
  movedFunds: string;
};


export interface FixturePolicySignerClient {
  submitPolicy(): Promise<FixturePolicySubmission>;
  getPolicyStatus(policyId: string): Promise<FixturePolicyStatus>;
  callContract(): Promise<FixtureContractCallResult>;
  triggerDeniedTransfer(): Promise<FixtureDeniedTransferResult>;
}

const FIXTURE_POLICY_ID = "policy_fixture_001";

export function createFixturePolicySignerClient(): FixturePolicySignerClient {
  return {
    async submitPolicy(): Promise<FixturePolicySubmission> {
      return {
        policyId: FIXTURE_POLICY_ID,
        status: "submitted"
      };
    },

    async getPolicyStatus(policyId: string): Promise<FixturePolicyStatus> {
      return {
        policyId,
        status: "active"
      };
    },

    async callContract(): Promise<FixtureContractCallResult> {
      return {
        txHash: "0x" + "f".repeat(64),
        status: "submitted"
      };
    },

    async triggerDeniedTransfer(): Promise<FixtureDeniedTransferResult> {
      return {
        denied: true,
        reason:
          "Direct transfer rejected because target is not whitelisted and amount exceeds Policy cap.",
        attemptedTarget: "0xDeniedDirectTransfer",
        attemptedFunction: "transfer",
        attemptedAmount: "10 SETH",
        movedFunds: "0 test USDC"
      };
    }
  };
}
