// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Step3Authorize } from "../components/steps/Step3Authorize";
import type { PolicySummary, Task } from "@proofmarket/shared/src/types";
import type { PolicyDenialRecord } from "@proofmarket/shared/src/realMode";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const policy: PolicySummary = {
  intent: "Fund one provider research job",
  totalBudget: "5 USDC",
  perJobCap: "1 USDC",
  allowedTargets: ["ProofMarketEscrow", "Injective USDC"],
  allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
  denyRules: ["direct transfer", "non-whitelisted target", "amount above cap", "expired policy"],
  expiresInMinutes: 30,
  policyId: "policy_abc123",
  status: "active"
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "PolicyActive",
    budgetLimit: "5 USDC",
    selectedProviderIds: [],
    plan: null,
    policy,
    providerPackage: null,
    audit: [],
    jobId: null,
    mode: "fixture",
    txRecords: [],
    claudePlanRaw: null,
    denial: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const noop = vi.fn();

describe("Step3Authorize — policy boundary values", () => {
  it("renders the policy ID in mono", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("policy_abc123")).toBeTruthy();
  });

  it("renders total budget", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    // totalBudget appears twice: once in DataRow value, and may appear in policy boundary
    expect(screen.getAllByText("5 USDC").length).toBeGreaterThan(0);
  });

  it("frames the budget as escrow-enforced (the signing policy has no amount cap)", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    // The misleading per-tx amount cap is gone; budget is attributed to escrow.
    expect(screen.getByText(/actual payout is also constrained by the escrow job budget/)).toBeTruthy();
  });

  it("renders expiry time", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/Valid for 30 minutes/)).toBeTruthy();
  });

  it("renders allowedTargets (contract names)", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("ProofMarketEscrow")).toBeTruthy();
    expect(screen.getByText("Injective USDC")).toBeTruthy();
  });

  it("renders allowedFunctions", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("createJob")).toBeTruthy();
    expect(screen.getByText("fund")).toBeTruthy();
  });

  it("renders deny rules", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("Deny direct transfers")).toBeTruthy();
  });
});

describe("Step3Authorize — authorization state", () => {
  it("shows active authorization when policy status is active", () => {
    render(
      <Step3Authorize
        task={task({ status: "PolicyActive", policy: { ...policy, status: "active" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("Authorization active")).toBeTruthy();
  });

  it("shows Execute Purchase button when policy is active", () => {
    render(
      <Step3Authorize
        task={task({ status: "PolicyActive", policy: { ...policy, status: "active" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByRole("button", { name: /Execute Purchase/ })).toBeTruthy();
  });

  it("shows Check approval status when policy status is submitted", () => {
    render(
      <Step3Authorize
        task={task({ status: "PolicySubmitted", policy: { ...policy, status: "submitted" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/Wait for the Policy Signer policy to activate/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check approval status" })).toBeTruthy();
  });

  it("disables Execute Purchase when policy is submitted (not yet approved)", () => {
    render(
      <Step3Authorize
        task={task({ status: "PolicySubmitted", policy: { ...policy, status: "submitted" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    const btn = screen.getByRole("button", { name: /Execute Purchase/ });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Step3Authorize — denial card", () => {
  const denial: PolicyDenialRecord = {
    denied: true,
    exitCode: 403,
    attemptedAction: "transfer 10 USDC to 0xEvilAddress",
    rawOutput: "POLICY_SIGNER_DENY: amount exceeds policy cap; target not whitelisted"
  };

  it("renders denial card when task.denial is set", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByPolicy",
          policy: { ...policy, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/Out-of-bound action rejected by the Policy Signer/)).toBeTruthy();
  });

  it("shows the attemptedAction in the denial card", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByPolicy",
          policy: { ...policy, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("transfer 10 USDC to 0xEvilAddress")).toBeTruthy();
  });

  it("summarizes the restricted signer denial and keeps rawOutput behind a disclosure", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByPolicy",
          policy: { ...policy, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("Reject reason")).toBeTruthy();
    expect(screen.getAllByText(/amount exceeds policy cap/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("View raw Policy Signer response")).toBeTruthy();
    expect(screen.getByText("POLICY_SIGNER_DENY: amount exceeds policy cap; target not whitelisted")).toBeTruthy();
  });

  it("shows zero-funds-moved reassurance after denial", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByPolicy",
          policy: { ...policy, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/zero on-chain funds moved/)).toBeTruthy();
  });

  it("still shows Execute Purchase after denial (denial does not block progress)", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByPolicy",
          policy: { ...policy, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    const btn = screen.getByRole("button", { name: /Execute Purchase/ });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not render denial card when task.denial is null", () => {
    render(
      <Step3Authorize
        task={task({ status: "PolicyActive", denial: null })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.queryByText(/Out-of-bound action rejected by the Policy Signer/)).toBeNull();
  });
});
