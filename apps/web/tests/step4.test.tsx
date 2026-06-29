// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Step4Onchain } from "../components/steps/Step4Onchain";
import type { Task } from "@proofmarket/shared/src/types";
import type { TxRecord } from "@proofmarket/shared/src/realMode";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const FULL_TX_HASH_1 = "0x" + "a".repeat(64);
const FULL_TX_HASH_2 = "0x" + "b".repeat(64);
const FULL_TX_HASH_3 = "0x" + "c".repeat(64);
const FULL_TX_HASH_4 = "0x" + "d".repeat(64);
const repeatedHexHash = /^0x([0-9a-f])\1{63}$/i;

const confirmedRecords: TxRecord[] = [
  { label: "approve", policySignerRequestId: "signer_1", txHash: FULL_TX_HASH_1, status: "confirmed" },
  { label: "createJob", policySignerRequestId: "signer_2", txHash: FULL_TX_HASH_2, status: "confirmed" },
  { label: "setBudget", policySignerRequestId: "signer_3", txHash: FULL_TX_HASH_3, status: "confirmed" },
  { label: "fund", policySignerRequestId: "signer_4", txHash: FULL_TX_HASH_4, status: "confirmed" }
];

const partialRecords: TxRecord[] = [
  { label: "approve", policySignerRequestId: "signer_1", txHash: FULL_TX_HASH_1, status: "confirmed" },
  { label: "createJob", policySignerRequestId: null, txHash: "", status: "pending" }
];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "JobFunded",
    budgetLimit: "5 USDC",
    selectedProviderIds: [],
    plan: null,
    policy: null,
    providerPackage: null,
    audit: [],
    jobId: 42,
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

describe("Step4Onchain — tx list rendering", () => {
  it("renders all 4 Chinese tx labels when records present", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("Approve token")).toBeTruthy();
    expect(screen.getByText("Create Provider job")).toBeTruthy();
    expect(screen.getByText("Set budget")).toBeTruthy();
    expect(screen.getByText("Fund escrow")).toBeTruthy();
  });

  it("renders staged demo procurement rows when txRecords is empty but status is JobFunded (fixture mode)", async () => {
    vi.useFakeTimers();
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "JobFunded" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("Approve token")).toBeTruthy();
    expect(screen.queryByText("No testnet transaction details")).toBeNull();
    expect(screen.queryByRole("button", { name: /Get Evidence Package/ })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_100);
    });

    expect(screen.getByText("Create Provider job")).toBeTruthy();
    expect(screen.getByText("Set budget")).toBeTruthy();
    expect(screen.getByText("Fund escrow")).toBeTruthy();
    expect(screen.getAllByText("Confirmed").length).toBe(4);
    const txHrefs = screen
      .getAllByRole("link")
      .map((link) => (link as HTMLAnchorElement).href);
    expect(txHrefs.some((href) => repeatedHexHash.test(href.split("/").at(-1) ?? ""))).toBe(false);
    expect(screen.getByRole("button", { name: /Get Evidence Package/ })).toBeTruthy();
  });

  it("shows waiting message when txRecords is empty and status is NOT JobFunded (mid-execute)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "PolicyActive" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("Waiting for purchase execution to finish...")).toBeTruthy();
  });

  it("shows Confirmed badge for confirmed records", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
      />
    );
    const badges = screen.getAllByText("Confirmed");
    expect(badges.length).toBe(4);
  });

  it("shows In progress badge for pending records", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: partialRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("In progress")).toBeTruthy();
  });

  it("shows in-progress pulse text for pending records", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: partialRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("In progress...")).toBeTruthy();
  });
});

describe("Step4Onchain — confirmed tx links to etherscan", () => {
  it("links confirmed full-hash records to Injective Explorer", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
      />
    );
    const links = document.querySelectorAll<HTMLAnchorElement>("a.hash");
    expect(links.length).toBe(4);

    const hrefs = Array.from(links).map((a) => a.href);
    expect(hrefs[0]).toContain("testnet.blockscout.injective.network/tx/");
    expect(hrefs[0]).toContain(FULL_TX_HASH_1);
  });

  it("does not link non-full hashes (pending records)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: partialRecords })}
        onGetEvidence={noop}
      />
    );
    // Only 1 confirmed record with full hash → 1 link
    const links = document.querySelectorAll<HTMLAnchorElement>("a.hash");
    expect(links.length).toBe(1);
    expect(links[0].href).toContain(FULL_TX_HASH_1);
  });
});

describe("Step4Onchain — Get Evidence Package action", () => {
  it("shows Get Evidence Package button when all 4 escrow records are confirmed", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByRole("button", { name: /Get Evidence Package/ })).toBeTruthy();
  });

  it("does NOT show Get Evidence Package when status is not JobFunded (mid-execute, partial records)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: partialRecords, status: "PolicyActive" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /Get Evidence Package/ })).toBeNull();
  });

  it("waits to show Get Evidence Package until fixture-mode staged txs finish", async () => {
    vi.useFakeTimers();
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "JobFunded" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /Get Evidence Package/ })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_100);
    });

    expect(screen.getByRole("button", { name: /Get Evidence Package/ })).toBeTruthy();
  });

  it("shows the staged procurement line in fixture mode", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "JobFunded" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("Waiting for purchase execution to finish...")).toBeTruthy();
  });

  // Mid-execute: status NOT JobFunded, empty txRecords — no button, calm wait.
  it("does NOT show Get Evidence Package when mid-execute (non-JobFunded status + empty txRecords)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "PolicyActive" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /Get Evidence Package/ })).toBeNull();
    expect(screen.getByText("Waiting for purchase execution to finish...")).toBeTruthy();
  });

  it("disables Get Evidence Package when isBusy is true", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
        isBusy={true}
      />
    );
    const btn = screen.getByRole("button", { name: /Get Evidence Package/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders additional records (submit/complete) if present", () => {
    const extraRecords: TxRecord[] = [
      ...confirmedRecords,
      { label: "submit", policySignerRequestId: "signer_5", txHash: FULL_TX_HASH_1, status: "confirmed" },
      { label: "complete", policySignerRequestId: "signer_6", txHash: FULL_TX_HASH_2, status: "confirmed" }
    ];
    render(
      <Step4Onchain
        task={task({ txRecords: extraRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("Submit package")).toBeTruthy();
    expect(screen.getByText("Settle payment")).toBeTruthy();
  });
});
