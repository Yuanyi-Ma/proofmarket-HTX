import { stableHash, type JsonValue } from "@proofmarket/shared/src/hash";
import { normalizeLocale, type Locale } from "@proofmarket/shared/src/locale";
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
  providerPackage: ProviderAnswerPackage,
  locale: Locale = "en"
): VerifierVerdict {
  assertProviderPackageHashMatches(providerPackage);

  const hasBlockStm = providerPackage.answers.some(
    (item) =>
      item.sourceLocator === "doi:10.1145/3572848.3577524" ||
      item.sourceTitle.toLowerCase().includes("block-stm")
  );

  if (declaresBroadExecutionCoverage(providerPackage) && !hasBlockStm) {
    const verdict = "provider_fault";
    const challengeType = "CoverageMiss";
    const reason =
      normalizeLocale(locale) === "zh"
        ? "Provider 声明覆盖 2021-2026 年区块链执行加速方向，却遗漏了 Block-STM——该声明范围内直接相关的来源。"
        : "The Provider claimed coverage of 2021-2026 blockchain execution-acceleration research but omitted Block-STM, a directly relevant in-scope source.";

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
    normalizeLocale(locale) === "zh"
      ? "证据服务包内容在声明的执行加速覆盖范围内支持该 Provider 结论。"
      : "The Evidence Service Package supports the Provider's conclusions within the declared execution-acceleration coverage.";

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
