// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Step4Onchain } from "../components/steps/Step4Onchain";
import type { Task } from "@proofmarket/shared/src/types";
import type { TxRecord } from "@proofmarket/shared/src/realMode";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const FULL_TX_HASH_1 = "0x" + "a".repeat(64);
const FULL_TX_HASH_2 = "0x" + "b".repeat(64);
const FULL_TX_HASH_3 = "0x" + "c".repeat(64);
const FULL_TX_HASH_4 = "0x" + "d".repeat(64);

const confirmedRecords: TxRecord[] = [
  { label: "approve", coboTxId: "cobo_1", txHash: FULL_TX_HASH_1, status: "confirmed" },
  { label: "createJob", coboTxId: "cobo_2", txHash: FULL_TX_HASH_2, status: "confirmed" },
  { label: "setBudget", coboTxId: "cobo_3", txHash: FULL_TX_HASH_3, status: "confirmed" },
  { label: "fund", coboTxId: "cobo_4", txHash: FULL_TX_HASH_4, status: "confirmed" }
];

const partialRecords: TxRecord[] = [
  { label: "approve", coboTxId: "cobo_1", txHash: FULL_TX_HASH_1, status: "confirmed" },
  { label: "createJob", coboTxId: null, txHash: "", status: "pending" }
];

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "JobFunded",
    budgetLimit: "5 test USDC",
    selectedProviderIds: [],
    plan: null,
    pact: null,
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
    expect(screen.getByText("授权代币")).toBeTruthy();
    expect(screen.getByText("创建委托订单")).toBeTruthy();
    expect(screen.getByText("设定预算")).toBeTruthy();
    expect(screen.getByText("注入托管资金")).toBeTruthy();
  });

  it("shows 演示模式 message when txRecords is empty but status is JobFunded (fixture mode)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "JobFunded" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("本地模拟模式：未连接测试网，无链上交易明细。")).toBeTruthy();
  });

  it("shows 等待链上确认 message when txRecords is empty and status is NOT JobFunded (mid-execute)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "PactActive" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("等待链上确认…")).toBeTruthy();
  });

  it("shows 已确认 badge for confirmed records", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
      />
    );
    const badges = screen.getAllByText("已确认");
    expect(badges.length).toBe(4);
  });

  it("shows 进行中 badge for pending records", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: partialRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("进行中")).toBeTruthy();
  });

  it("shows in-progress pulse text for pending records", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: partialRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("进行中…")).toBeTruthy();
  });
});

describe("Step4Onchain — confirmed tx links to etherscan", () => {
  it("links confirmed full-hash records to Sepolia Etherscan", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
      />
    );
    const links = document.querySelectorAll<HTMLAnchorElement>("a.hash");
    expect(links.length).toBe(4);

    const hrefs = Array.from(links).map((a) => a.href);
    expect(hrefs[0]).toContain("sepolia.etherscan.io/tx/");
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

describe("Step4Onchain — 获取研究简报 action", () => {
  it("shows 获取研究简报 button when all 4 escrow records are confirmed", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByRole("button", { name: /获取研究简报/ })).toBeTruthy();
  });

  it("does NOT show 获取研究简报 when status is not JobFunded (mid-execute, partial records)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: partialRecords, status: "PactActive" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /获取研究简报/ })).toBeNull();
  });

  // Fixture mode: status is JobFunded, txRecords is empty — button MUST appear.
  it("shows 获取研究简报 button in fixture mode (JobFunded + empty txRecords)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "JobFunded" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByRole("button", { name: /获取研究简报/ })).toBeTruthy();
  });

  // Fixture mode also shows the honest 演示模式 line alongside the button.
  it("shows 演示模式 honest line in fixture mode (JobFunded + empty txRecords)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "JobFunded" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("本地模拟模式：未连接测试网，无链上交易明细。")).toBeTruthy();
  });

  // Mid-execute: status NOT JobFunded, empty txRecords — no button, calm wait.
  it("does NOT show 获取研究简报 when mid-execute (non-JobFunded status + empty txRecords)", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: [], status: "PactActive" })}
        onGetEvidence={noop}
      />
    );
    expect(screen.queryByRole("button", { name: /获取研究简报/ })).toBeNull();
    expect(screen.getByText("等待链上确认…")).toBeTruthy();
  });

  it("disables 获取研究简报 when isBusy is true", () => {
    render(
      <Step4Onchain
        task={task({ txRecords: confirmedRecords })}
        onGetEvidence={noop}
        isBusy={true}
      />
    );
    const btn = screen.getByRole("button", { name: /获取研究简报/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders additional records (submit/complete) if present", () => {
    const extraRecords: TxRecord[] = [
      ...confirmedRecords,
      { label: "submit", coboTxId: "cobo_5", txHash: FULL_TX_HASH_1, status: "confirmed" },
      { label: "complete", coboTxId: "cobo_6", txHash: FULL_TX_HASH_2, status: "confirmed" }
    ];
    render(
      <Step4Onchain
        task={task({ txRecords: extraRecords })}
        onGetEvidence={noop}
      />
    );
    expect(screen.getByText("提交简报")).toBeTruthy();
    expect(screen.getByText("结算放款")).toBeTruthy();
  });
});
