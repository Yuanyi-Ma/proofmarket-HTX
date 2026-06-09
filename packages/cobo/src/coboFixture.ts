// Fixture-mode types — intentionally separate from the real CLI client types
// so the fixture interface is stable regardless of CLI changes.

export type FixturePactSubmission = {
  pactId: string;
  status: "submitted" | "active" | "denied" | "expired";
};

export type FixturePactStatus = {
  pactId: string;
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


export interface FixtureCoboClient {
  submitPact(): Promise<FixturePactSubmission>;
  getPactStatus(pactId: string): Promise<FixturePactStatus>;
  callContract(): Promise<FixtureContractCallResult>;
  triggerDeniedTransfer(): Promise<FixtureDeniedTransferResult>;
}

const FIXTURE_PACT_ID = "pact_fixture_001";

export function createFixtureCoboClient(): FixtureCoboClient {
  return {
    async submitPact(): Promise<FixturePactSubmission> {
      return {
        pactId: FIXTURE_PACT_ID,
        status: "submitted"
      };
    },

    async getPactStatus(pactId: string): Promise<FixturePactStatus> {
      return {
        pactId,
        status: "active"
      };
    },

    async callContract(): Promise<FixtureContractCallResult> {
      return {
        txHash: "0xcobo_fixture_tx_001",
        status: "submitted"
      };
    },

    async triggerDeniedTransfer(): Promise<FixtureDeniedTransferResult> {
      return {
        denied: true,
        reason:
          "Direct transfer rejected because target is not whitelisted and amount exceeds Pact cap.",
        attemptedTarget: "0xDeniedDirectTransfer",
        attemptedFunction: "transfer",
        attemptedAmount: "10 SETH",
        movedFunds: "0 test USDC"
      };
    }
  };
}
