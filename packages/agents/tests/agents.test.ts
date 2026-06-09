import { describe, expect, it } from "vitest";
import { defaultQuestion } from "@proofmarket/shared/src/fixtures";
import { generateProcurementPlan } from "../src/researchAgent";
import { hashProviderAnswerPackage, runProvider } from "../src/providers";
import { hashVerifierResult, verifyPackage } from "../src/verifierAgent";

describe("deterministic ProofMarket agents", () => {
  it("recommends the execution research expert", () => {
    const plan = generateProcurementPlan("task_001", defaultQuestion);
    expect(plan.providerCount).toBe(3);
    expect(plan.recommendedProviderId).toBe("execution-research-expert");
  });

  it("accepts the expert provider package", () => {
    const providerPackage = runProvider("task_001", "execution-research-expert");
    const verdict = verifyPackage(providerPackage);
    expect(verdict.verdict).toBe("valid");
  });

  it("flags shallow provider as coverage miss", () => {
    const providerPackage = runProvider("task_002", "shallow-search-provider");
    const verdict = verifyPackage(providerPackage);
    expect(verdict.verdict).toBe("provider_fault");
    expect(verdict.challengeType).toBe("CoverageMiss");
  });

  it("returns a hex package hash for the expert provider package", () => {
    const providerPackage = runProvider("task_001", "execution-research-expert");
    expect(providerPackage.packageHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("returns a deterministic expert provider package hash", () => {
    const firstPackage = runProvider("task_001", "execution-research-expert");
    const secondPackage = runProvider("task_001", "execution-research-expert");
    expect(secondPackage.packageHash).toBe(firstPackage.packageHash);
  });

  it("recomputes provider package hash from a package preimage", () => {
    const providerPackage = runProvider("task_001", "execution-research-expert");
    const { packageHash, ...preimage } = providerPackage;
    expect(hashProviderAnswerPackage(preimage)).toBe(packageHash);
  });

  it("uses different package hashes for different provider content", () => {
    const expertPackage = runProvider("task_001", "execution-research-expert");
    const shallowPackage = runProvider("task_001", "shallow-search-provider");
    expect(shallowPackage.packageHash).not.toBe(expertPackage.packageHash);
  });

  it("returns a hex result hash for a valid verifier result", () => {
    const providerPackage = runProvider("task_001", "execution-research-expert");
    const verdict = verifyPackage(providerPackage);
    expect(verdict.resultHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("recomputes valid verifier result hash from a result preimage", () => {
    const providerPackage = runProvider("task_001", "execution-research-expert");
    const verdict = verifyPackage(providerPackage);

    if (verdict.verdict !== "valid") {
      throw new Error("Expected valid verifier verdict");
    }

    expect(
      hashVerifierResult({
        packageHash: providerPackage.packageHash,
        verdict: verdict.verdict,
        challengeType: null,
        reason: verdict.reason
      })
    ).toBe(verdict.resultHash);
  });

  it("recomputes coverage-miss verifier result hash from a result preimage", () => {
    const providerPackage = runProvider("task_002", "shallow-search-provider");
    const verdict = verifyPackage(providerPackage);

    if (verdict.verdict !== "provider_fault") {
      throw new Error("Expected provider fault verifier verdict");
    }

    expect(
      hashVerifierResult({
        packageHash: providerPackage.packageHash,
        verdict: verdict.verdict,
        challengeType: "CoverageMiss",
        reason: verdict.reason
      })
    ).toBe(verdict.resultHash);
  });

  it("rejects tampered provider packages before returning a verdict", () => {
    const providerPackage = runProvider("task_001", "execution-research-expert");
    const tamperedPackage = {
      ...providerPackage,
      answers: providerPackage.answers.map((answer, index) =>
        index === 0
          ? { ...answer, providerAnswer: "Tampered provider answer." }
          : answer
      )
    };

    expect(() => verifyPackage(tamperedPackage)).toThrow(
      "Provider package hash mismatch"
    );
  });
});
