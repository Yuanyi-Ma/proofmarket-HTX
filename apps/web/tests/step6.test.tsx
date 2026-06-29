// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Step6Done } from "../components/steps/Step6Done";
import type { Task, ProviderAnswerPackage } from "@proofmarket/shared/src/types";
import type { TxRecord } from "@proofmarket/shared/src/realMode";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const FULL_TX_HASH_1 = "0x" + "a".repeat(64);
const FULL_TX_HASH_2 = "0x" + "b".repeat(64);
const FULL_TX_HASH_3 = "0x" + "c".repeat(64);
const FULL_TX_HASH_4 = "0x" + "d".repeat(64);
const FULL_TX_HASH_5 = "0x" + "e".repeat(64);
const FULL_TX_HASH_6 = "0x" + "f".repeat(64);

const pkg: ProviderAnswerPackage = {
  taskId: "task_001",
  providerAgentId: 1,
  providerId: "execution-research-expert",
  providerName: "Execution Research Provider",
  coverageStatement: "Covers 2021-2026 blockchain transaction execution acceleration papers",
  answers: [
    {
      providerAnswer: "Optimistic parallel execution is the core direction for current execution acceleration.",
      sourceTitle: "Block-STM",
      sourceLocator: "arXiv:2203.06871",
      sourceLibrary: "arxiv",
      sourceMetadata: { year: 2022, type: "paper" },
      excerptOrSummary: "Block-STM uses optimistic concurrency control to execute ordered transactions in parallel.",
      relevanceExplanation: "Directly relevant, but cannot prove universal applicability to all workloads."
    },
    {
      providerAnswer: "Speculative execution can reduce latency.",
      sourceTitle: "Speculative Execution Survey",
      sourceLocator: "arXiv:2301.09999",
      sourceLibrary: "arxiv",
      sourceMetadata: { year: 2023, type: "paper" },
      excerptOrSummary: "Surveys speculative execution applications in blockchain systems.",
      relevanceExplanation: "Relevant to the topic, with coverage limited to EVM-compatible chains."
    }
  ],
  packageHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
};

const allTxRecords: TxRecord[] = [
  { label: "approve", policySignerRequestId: "signer_1", txHash: FULL_TX_HASH_1, status: "confirmed" },
  { label: "createJob", policySignerRequestId: "signer_2", txHash: FULL_TX_HASH_2, status: "confirmed" },
  { label: "setBudget", policySignerRequestId: "signer_3", txHash: FULL_TX_HASH_3, status: "confirmed" },
  { label: "fund", policySignerRequestId: "signer_4", txHash: FULL_TX_HASH_4, status: "confirmed" },
  { label: "submit", policySignerRequestId: "signer_5", txHash: FULL_TX_HASH_5, status: "confirmed" },
  { label: "complete", policySignerRequestId: "signer_6", txHash: FULL_TX_HASH_6, status: "confirmed" }
];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "What are the latest studies on blockchain transaction execution acceleration?",
    status: "Settled",
    budgetLimit: "5 USDC",
    selectedProviderIds: ["execution-research-expert"],
    plan: null,
    policy: {
      intent: "Fund one provider research job",
      totalBudget: "5 USDC",
      perJobCap: "1 USDC",
      allowedTargets: ["ProofMarketEscrow", "Injective USDC"],
      allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
      denyRules: ["direct transfer"],
      expiresInMinutes: 30,
      policyId: "policy_abc123",
      status: "active"
    },
    providerPackage: pkg,
    audit: [
      {
        id: "evt_01",
        taskId: "task_001",
        source: "verifier",
        type: "verification_passed",
        result: "success",
        message: "Judge verdict: valid. verdictHash=0x" + "9".repeat(64),
        txHash: null,
        policyId: null,
        jobId: 42,
        createdAt: "2026-01-01T00:01:00.000Z"
      }
    ],
    jobId: 42,
    mode: "fixture",
    txRecords: allTxRecords,
    claudePlanRaw: null,
    denial: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

const noop = vi.fn();

describe("Step6Done — final answer (settled)", () => {
  it("renders the conclusion from providerPackage first answer", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText("Optimistic parallel execution is the core direction for current execution acceleration.")).toBeTruthy();
  });

  it("renders evidence summary with count", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText(/2 source items/)).toBeTruthy();
  });

  it("renders source title in evidence summary", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText(/Block-STM/)).toBeTruthy();
  });
});

describe("Step6Done — transactions and receipts (settled)", () => {
  it("renders all 6 tx records with English labels", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText(/Approve token/)).toBeTruthy();
    expect(screen.getByText(/Create Provider job/)).toBeTruthy();
    expect(screen.getByText(/Set budget/)).toBeTruthy();
    expect(screen.getByText(/Fund escrow/)).toBeTruthy();
    expect(screen.getByText(/Submit package/)).toBeTruthy();
    expect(screen.getByText(/Settle payment/)).toBeTruthy();
  });

  it("renders all 6 tx hashes as Injective Explorer links", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    const links = document.querySelectorAll<HTMLAnchorElement>("a.hash");
    expect(links.length).toBe(6);
    for (const link of Array.from(links)) {
      expect(link.href).toContain("testnet.blockscout.injective.network/tx/");
    }
  });

  it("renders jobId in mono", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("renders policyId in mono", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText("policy_abc123")).toBeTruthy();
  });

  it("renders packageHash in mono", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(
      screen.getByText("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab")
    ).toBeTruthy();
  });

  it("renders verdictHash from audit events", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    // The audit event message contains verdictHash=0x999...
    expect(screen.getByText("0x" + "9".repeat(64))).toBeTruthy();
  });
});

describe("Step6Done — actions (settled)", () => {
  it("shows exactly one Start New Task button", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    const btns = screen.getAllByRole("button", { name: /Start New Task/ });
    expect(btns.length).toBe(1);
  });

  it("shows View Full Audit button", () => {
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByRole("button", { name: /View Full Audit/ })).toBeTruthy();
  });

  it("calls onReset when Start New Task is clicked", () => {
    const onReset = vi.fn();
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={onReset}
        onOpenAudit={noop}
      />
    );
    screen.getByRole("button", { name: /Start New Task/ }).click();
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("calls onOpenAudit when View Full Audit is clicked", () => {
    const onOpenAudit = vi.fn();
    render(
      <Step6Done
        task={task()}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={onOpenAudit}
      />
    );
    screen.getByRole("button", { name: /View Full Audit/ }).click();
    expect(onOpenAudit).toHaveBeenCalledOnce();
  });
});

describe("Step6Done — Verified (pre-settle)", () => {
  it("shows Confirm Settlement button when status is Verified", () => {
    render(
      <Step6Done
        task={task({ status: "Verified" })}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByRole("button", { name: /Confirm Settlement/ })).toBeTruthy();
  });

  it("shows pending message when Verified (not yet settled)", () => {
    render(
      <Step6Done
        task={task({ status: "Verified" })}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText(/Evidence package verified/)).toBeTruthy();
  });

  it("does NOT show receipt when Verified (not yet settled)", () => {
    render(
      <Step6Done
        task={task({ status: "Verified" })}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    // Receipt section only shows on Settled/Audited
    expect(screen.queryByText(/Transactions and Receipts/)).toBeNull();
  });

  it("disables Confirm Settlement when isBusy", () => {
    render(
      <Step6Done
        task={task({ status: "Verified" })}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
        isBusy={true}
      />
    );
    const btn = screen.getByRole("button", { name: /Confirm Settlement/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Step6Done — Audited state", () => {
  it("renders receipt when status is Audited", () => {
    render(
      <Step6Done
        task={task({ status: "Audited" })}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    expect(screen.getByText(/Transactions and Receipts/)).toBeTruthy();
  });
});

describe("Step6Done — challenge window gate (W_c)", () => {
  it("allows the client to settle immediately by choosing not to challenge", () => {
    const endsAt = new Date(Date.now() + 120_000).toISOString();
    render(
      <Step6Done
        task={task({ status: "Verified", challengeWindowEndsAt: endsAt })}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    const btn = screen.getByRole("button", { name: /Settle Now/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("settle-window-note").textContent).toContain(
      "settle now"
    );
  });

  it("re-enables Confirm Settlement once the window has passed", () => {
    const endsAt = new Date(Date.now() - 1_000).toISOString();
    render(
      <Step6Done
        task={task({ status: "Verified", challengeWindowEndsAt: endsAt })}
        onSettle={noop}
        onRate={noop}
        onReset={noop}
        onOpenAudit={noop}
      />
    );
    const btn = screen.getByRole("button", { name: /Confirm Settlement/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId("settle-window-note").textContent).toContain("challenge window is closed");
  });
});
