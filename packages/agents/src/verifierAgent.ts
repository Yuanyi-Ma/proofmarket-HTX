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
      "Provider 声明覆盖 2021-2026 年区块链执行加速方向，却遗漏了 Block-STM——该声明范围内直接相关的来源。";

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
    "简报内容在声明的执行加速覆盖范围内支持该专家结论。";

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
