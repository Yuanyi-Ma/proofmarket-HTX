// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Step3Authorize } from "../components/steps/Step3Authorize";
import type { PactSummary, Task } from "@proofmarket/shared/src/types";
import type { CoboDenialRecord } from "@proofmarket/shared/src/realMode";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const pact: PactSummary = {
  intent: "Fund one provider research job",
  totalBudget: "5 test USDC",
  perJobCap: "1 test USDC",
  allowedTargets: ["ProofMarketEscrow", "MockUSDC"],
  allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
  denyRules: ["direct transfer", "non-whitelisted target", "amount above cap", "expired pact"],
  expiresInMinutes: 30,
  pactId: "pact_abc123",
  status: "active"
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "PactActive",
    budgetLimit: "5 test USDC",
    selectedProviderIds: [],
    plan: null,
    pact,
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

describe("Step3Authorize — pact boundary values", () => {
  it("renders the pact ID in mono", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("pact_abc123")).toBeTruthy();
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
    // totalBudget appears twice: once in DataRow value, and may appear in pact boundary
    expect(screen.getAllByText("5 test USDC").length).toBeGreaterThan(0);
  });

  it("frames the budget as escrow-enforced (Cobo policy has no amount cap)", () => {
    render(
      <Step3Authorize
        task={task()}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    // The misleading per-tx amount cap is gone; budget is attributed to escrow.
    expect(screen.getByText(/放款金额由托管合约按订单预算约束/)).toBeTruthy();
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
    expect(screen.getByText(/30 分钟内有效/)).toBeTruthy();
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
    expect(screen.getByText("MockUSDC")).toBeTruthy();
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
    expect(screen.getByText("禁止直接转账")).toBeTruthy();
  });
});

describe("Step3Authorize — authorization state", () => {
  it("shows 已授权 when pact status is active", () => {
    render(
      <Step3Authorize
        task={task({ status: "PactActive", pact: { ...pact, status: "active" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/已授权（演示钱包自动批准）/)).toBeTruthy();
  });

  it("shows 执行链上采购 button when pact is active", () => {
    render(
      <Step3Authorize
        task={task({ status: "PactActive", pact: { ...pact, status: "active" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByRole("button", { name: /执行链上采购/ })).toBeTruthy();
  });

  it("shows 检查批准状态 when pact status is submitted", () => {
    render(
      <Step3Authorize
        task={task({ status: "PactSubmitted", pact: { ...pact, status: "submitted" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/请在 Cobo App 中批准此授权/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "检查批准状态" })).toBeTruthy();
  });

  it("disables 执行链上采购 when pact is submitted (not yet approved)", () => {
    render(
      <Step3Authorize
        task={task({ status: "PactSubmitted", pact: { ...pact, status: "submitted" } })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    const btn = screen.getByRole("button", { name: /执行链上采购/ });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Step3Authorize — denial card", () => {
  const denial: CoboDenialRecord = {
    denied: true,
    exitCode: 403,
    attemptedAction: "transfer 10 USDC to 0xEvilAddress",
    rawOutput: "COBO_DENY: amount exceeds pact cap; target not whitelisted"
  };

  it("renders denial card when task.denial is set", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByCobo",
          pact: { ...pact, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/越权操作已被 Cobo 拦截/)).toBeTruthy();
  });

  it("shows the attemptedAction in the denial card", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByCobo",
          pact: { ...pact, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("transfer 10 USDC to 0xEvilAddress")).toBeTruthy();
  });

  it("shows the Cobo rawOutput in the denial card", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByCobo",
          pact: { ...pact, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText("COBO_DENY: amount exceeds pact cap; target not whitelisted")).toBeTruthy();
  });

  it("shows zero-funds-moved reassurance after denial", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByCobo",
          pact: { ...pact, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.getByText(/链上零资金流出/)).toBeTruthy();
  });

  it("still shows 执行链上采购 after denial (denial does not block progress)", () => {
    render(
      <Step3Authorize
        task={task({
          status: "DeniedByCobo",
          pact: { ...pact, status: "active" },
          denial
        })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    const btn = screen.getByRole("button", { name: /执行链上采购/ });
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not render denial card when task.denial is null", () => {
    render(
      <Step3Authorize
        task={task({ status: "PactActive", denial: null })}
        onExecute={noop}
        onCheckApproval={noop}
        onTriggerDenial={noop}
      />
    );
    expect(screen.queryByText(/越权操作已被 Cobo 拦截/)).toBeNull();
  });
});
