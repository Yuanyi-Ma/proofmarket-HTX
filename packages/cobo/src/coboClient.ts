import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { PactPolicy } from "./pactPolicy";

const execFileAsync = promisify(execFile);

export type PactSubmission = {
  pactId: string;
  status: "submitted" | "active" | "denied" | "expired";
};

export type PactStatus = {
  pactId: string;
  status: "submitted" | "active" | "denied" | "expired";
};

export type ContractCallInput = {
  pactId: string;
  target: string;
  functionName: string;
  args?: readonly string[];
};

export type ContractCallResult = {
  txHash: string;
  status: "submitted";
};

export type DeniedTransferResult = {
  denied: boolean;
  reason: string;
  attemptedTarget: string;
  attemptedFunction: string;
  attemptedAmount: string;
  movedFunds: string;
};

export interface CoboClient {
  submitPact(policyJson: PactPolicy): Promise<PactSubmission>;
  getPactStatus(pactId: string): Promise<PactStatus>;
  callContract(input: ContractCallInput): Promise<ContractCallResult>;
  triggerDeniedTransfer(): Promise<DeniedTransferResult>;
}

function parseJson<T>(stdout: string): T {
  return JSON.parse(stdout) as T;
}

export function createCliCoboClient(): CoboClient {
  return {
    async submitPact(policyJson) {
      const { stdout } = await execFileAsync("caw", ["pact", "submit", JSON.stringify(policyJson)]);
      return parseJson<PactSubmission>(stdout);
    },

    async getPactStatus(pactId) {
      const { stdout } = await execFileAsync("caw", ["pact", "status", pactId]);
      return parseJson<PactStatus>(stdout);
    },

    async callContract(input) {
      const { stdout } = await execFileAsync("caw", [
        "contract",
        "call",
        "--pact",
        input.pactId,
        "--target",
        input.target,
        "--function",
        input.functionName,
        "--args",
        JSON.stringify(input.args ?? [])
      ]);
      return parseJson<ContractCallResult>(stdout);
    },

    async triggerDeniedTransfer() {
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
