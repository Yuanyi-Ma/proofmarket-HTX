// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Step5Evidence } from "../components/steps/Step5Evidence";
import type { Task, ProviderAnswerPackage } from "@proofmarket/shared/src/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const pkg: ProviderAnswerPackage = {
  taskId: "task_001",
  providerAgentId: 1,
  providerId: "execution-research-expert",
  providerName: "区块链执行研究专家",
  coverageStatement: "覆盖 2021–2026 年区块链交易执行加速方向的论文",
  answers: [
    {
      providerAnswer: "乐观并行执行是当前执行加速的核心方向。",
      sourceTitle: "Block-STM",
      sourceLocator: "arXiv:2203.06871",
      sourceMetadata: { year: 2022, type: "paper" },
      excerptOrSummary: "Block-STM 通过乐观并发控制实现并行执行，减少冲突重执行。",
      relevanceExplanation: "直接支持执行加速主题，但不能证明普遍适用所有工作负载。"
    },
    {
      providerAnswer: "投机执行可进一步降低延迟。",
      sourceTitle: "Speculative Execution Survey",
      sourceLocator: "arXiv:2301.09999",
      sourceMetadata: { year: 2023, type: "paper" },
      excerptOrSummary: "综述了投机执行在区块链场景的应用与局限。",
      relevanceExplanation: "与主题相关，但覆盖范围仅限于 EVM 兼容链。"
    }
  ],
  packageHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab"
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "区块链交易执行加速的最新研究是什么？",
    status: "Delivered",
    budgetLimit: "5 test USDC",
    selectedProviderIds: ["execution-research-expert"],
    plan: null,
    pact: {
      intent: "Fund one provider research job",
      totalBudget: "5 test USDC",
      perJobCap: "1 test USDC",
      allowedTargets: ["ProofMarketEscrow", "MockUSDC"],
      allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
      denyRules: ["direct transfer"],
      expiresInMinutes: 30,
      pactId: "pact_abc123",
      status: "active"
    },
    providerPackage: pkg,
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

describe("Step5Evidence — evidence package rendering", () => {
  it("renders provider name", () => {
    render(
      <Step5Evidence
        task={task()}
        onVerify={noop}
      />
    );
    expect(screen.getByText("区块链执行研究专家")).toBeTruthy();
  });

  it("renders coverage statement", () => {
    render(
      <Step5Evidence
        task={task()}
        onVerify={noop}
      />
    );
    expect(screen.getByText("覆盖 2021–2026 年区块链交易执行加速方向的论文")).toBeTruthy();
  });

  it("renders source titles for all evidence items", () => {
    render(
      <Step5Evidence
        task={task()}
        onVerify={noop}
      />
    );
    expect(screen.getByText("Block-STM")).toBeTruthy();
    expect(screen.getByText("Speculative Execution Survey")).toBeTruthy();
  });

  it("renders source locators in summary (mono)", () => {
    render(
      <Step5Evidence
        task={task()}
        onVerify={noop}
      />
    );
    // Two locators displayed in the summary
    const locators = screen.getAllByText("arXiv:2203.06871");
    expect(locators.length).toBeGreaterThan(0);
  });

  it("renders package hash in mono", () => {
    render(
      <Step5Evidence
        task={task()}
        onVerify={noop}
      />
    );
    expect(
      screen.getByText("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab")
    ).toBeTruthy();
  });
});

describe("Step5Evidence — verify action state", () => {
  it("shows 核验证据 button when status is Delivered", () => {
    render(
      <Step5Evidence
        task={task({ status: "Delivered" })}
        onVerify={noop}
      />
    );
    expect(screen.getByRole("button", { name: /核验证据/ })).toBeTruthy();
  });

  it("does not show 核验证据 button in readOnly mode", () => {
    render(
      <Step5Evidence
        task={task({ status: "Delivered" })}
        onVerify={noop}
        readOnly={true}
      />
    );
    expect(screen.queryByRole("button", { name: /核验证据/ })).toBeNull();
  });

  it("disables 核验证据 when isBusy", () => {
    render(
      <Step5Evidence
        task={task({ status: "Delivered" })}
        onVerify={noop}
        isBusy={true}
      />
    );
    const btn = screen.getByRole("button", { name: /核验证据/ });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows 验证通过 status text when Verified", () => {
    render(
      <Step5Evidence
        task={task({ status: "Verified" })}
        onVerify={noop}
      />
    );
    expect(screen.getByText("验证通过")).toBeTruthy();
  });
});

describe("Step5Evidence — challenge mechanism note (honest placeholder)", () => {
  it("shows the challenge mechanism note in fixture mode", () => {
    render(
      <Step5Evidence
        task={task({ mode: "fixture", status: "Delivered" })}
        onVerify={noop}
      />
    );
    expect(screen.getByText(/完整的链上挑战流程开发中/)).toBeTruthy();
  });

  it("shows the challenge mechanism note in real mode", () => {
    render(
      <Step5Evidence
        task={task({ mode: "real", status: "Delivered" })}
        onVerify={noop}
      />
    );
    expect(screen.getByText(/完整的链上挑战流程开发中/)).toBeTruthy();
  });

  it("offers no user-initiated challenge action (no dead-end buttons)", () => {
    render(
      <Step5Evidence
        task={task({ mode: "fixture", status: "Delivered" })}
        onVerify={noop}
      />
    );
    expect(screen.queryByText(/对证据有疑问/)).toBeNull();
    // The only action on a Delivered task is 核验证据.
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain("核验证据");
  });

  it("shows 挑战中 status text when status is Challenged (verifier-driven state)", () => {
    render(
      <Step5Evidence
        task={task({ mode: "fixture", status: "Challenged" })}
        onVerify={noop}
      />
    );
    expect(screen.getAllByText(/挑战中/).length).toBeGreaterThan(0);
  });

  it("shows 挑战成立 status text when ChallengeWon", () => {
    render(
      <Step5Evidence
        task={task({ mode: "fixture", status: "ChallengeWon" })}
        onVerify={noop}
      />
    );
    expect(screen.getAllByText(/挑战成立/).length).toBeGreaterThan(0);
  });

  it("shows 已退款 / 已惩罚 status when RefundedOrSlashed", () => {
    render(
      <Step5Evidence
        task={task({ mode: "fixture", status: "RefundedOrSlashed" })}
        onVerify={noop}
      />
    );
    expect(screen.getAllByText(/已退款/).length).toBeGreaterThan(0);
  });
});

describe("Step5Evidence — no package", () => {
  it("shows waiting message when providerPackage is null", () => {
    render(
      <Step5Evidence
        task={task({ providerPackage: null })}
        onVerify={noop}
      />
    );
    expect(screen.getByText(/等待 Provider 交付证据包/)).toBeTruthy();
  });
});
