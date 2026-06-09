import { stableHash, type JsonValue } from "@proofmarket/shared/src/hash";
import type { ProviderAnswerPackage } from "@proofmarket/shared/src/types";
import {
  hashProviderAnswerPackage,
  type ProviderAnswerPackagePreimage
} from "./providers";

export type VerifierVerdict =
  | {
      verdict: "valid";
      challengeType?: never;
      reason: string;
      resultHash: string;
    }
  | {
      verdict: "provider_fault";
      challengeType: "CoverageMiss";
      reason: string;
      resultHash: string;
    };

export type VerifierResultPreimage = {
  packageHash: string;
  verdict: "valid" | "provider_fault";
  challengeType: "CoverageMiss" | null;
  reason: string;
};

export function hashVerifierResult(input: VerifierResultPreimage): string {
  const hashInput = {
    packageHash: input.packageHash,
    verdict: input.verdict,
    challengeType: input.challengeType,
    reason: input.reason
  } satisfies JsonValue;

  return stableHash(hashInput);
}

function declaresBroadExecutionCoverage(
  providerPackage: ProviderAnswerPackage
): boolean {
  return providerPackage.coverageStatement.includes("2021-2026");
}

function assertProviderPackageHashMatches(
  providerPackage: ProviderAnswerPackage
): void {
  const { packageHash, ...preimage } = providerPackage;
  const expectedHash = hashProviderAnswerPackage(
    preimage as ProviderAnswerPackagePreimage
  );

  if (expectedHash !== packageHash) {
    throw new Error("Provider package hash mismatch");
  }
}

export function verifyPackage(
  providerPackage: ProviderAnswerPackage
): VerifierVerdict {
  assertProviderPackageHashMatches(providerPackage);

  const hasBlockStm = providerPackage.answers.some(
    (item) =>
      item.sourceLocator === "arXiv:2203.06871" ||
      item.sourceTitle.toLowerCase().includes("block-stm")
  );

  if (declaresBroadExecutionCoverage(providerPackage) && !hasBlockStm) {
    const verdict = "provider_fault";
    const challengeType = "CoverageMiss";
    const reason =
      "Provider declared 2021-2026 blockchain execution acceleration coverage but missed Block-STM, a directly relevant source in the declared scope.";

    return {
      verdict,
      challengeType,
      reason,
      resultHash: hashVerifierResult({
        packageHash: providerPackage.packageHash,
        verdict,
        challengeType,
        reason
      })
    };
  }

  const verdict = "valid";
  const reason =
    "Evidence supports the provider answer within the declared execution-acceleration coverage scope.";

  return {
    verdict,
    reason,
    resultHash: hashVerifierResult({
      packageHash: providerPackage.packageHash,
      verdict,
      challengeType: null,
      reason
    })
  };
}
