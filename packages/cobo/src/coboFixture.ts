import type {
  CoboClient,
  ContractCallResult,
  DeniedTransferResult,
  PactStatus,
  PactSubmission
} from "./coboClient";

const FIXTURE_PACT_ID = "pact_fixture_001";

export function createFixtureCoboClient(): CoboClient {
  return {
    async submitPact(): Promise<PactSubmission> {
      return {
        pactId: FIXTURE_PACT_ID,
        status: "submitted"
      };
    },

    async getPactStatus(pactId: string): Promise<PactStatus> {
      return {
        pactId,
        status: "active"
      };
    },

    async callContract(): Promise<ContractCallResult> {
      return {
        txHash: "0xcobo_fixture_tx_001",
        status: "submitted"
      };
    },

    async triggerDeniedTransfer(): Promise<DeniedTransferResult> {
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
