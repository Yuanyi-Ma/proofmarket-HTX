// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "../app/page";
import type { ProcurementPlan, Task } from "@proofmarket/shared/src/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const plan: ProcurementPlan = {
  taskId: "task_001",
  userQuestion: "Question",
  evidenceNeed: "需要 2021-2026 执行加速一手论文证据，而非二手综述。",
  totalBudget: "5 test USDC",
  perJobCap: "1 test USDC",
  recommendedProviderId: "execution-research-expert",
  providerCount: 3,
  coverage: "Block-STM, parallel execution, conflict detection.",
  returnType: "provider-answer-package",
  verificationMethod: "Verifier checks locators, excerpts, relevance, coverage."
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "Created",
    budgetLimit: "5 test USDC",
    selectedProviderIds: [],
    plan: null,
    pact: null,
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("wizard step 1 → 2 flow", () => {
  it("starts on step 1 with the question form and empty audit state", () => {
    render(<Page />);

    expect(screen.getByText("提出你的研究问题")).toBeTruthy();
    expect(screen.getByRole("button", { name: "生成采购方案" })).toBeTruthy();
    expect(screen.getByText("审计日志")).toBeTruthy();
    expect(screen.getByText("尚无审计记录")).toBeTruthy();
  });

  it("auto-chains createTask → plan and lands on step 2 with the plan", async () => {
    const plannedTask = task({ status: "Planned", plan });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url === "/api/tasks") {
        return jsonResponse(task());
      }
      if (method === "POST" && url === "/api/tasks/task_001/plan") {
        return jsonResponse(plannedTask);
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "生成采购方案" }));

    // Step 2 renders the recommendation, the real Claude reason, and the
    // confirm action.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "确认方案，去授权" })).toBeTruthy();
    });
    expect(screen.getAllByText("执行加速研究专家 Agent").length).toBeGreaterThan(0);
    expect(screen.getByText(plan.evidenceNeed)).toBeTruthy();

    // Both POSTs happened without further clicks (auto-chain).
    const postUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([input]) => String(input));
    expect(postUrls).toEqual(["/api/tasks", "/api/tasks/task_001/plan"]);
  });

  it("lets the user review done step 1 read-only and return", async () => {
    const plannedTask = task({ status: "Planned", plan });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url === "/api/tasks") return jsonResponse(task());
      if (method === "POST" && url === "/api/tasks/task_001/plan") {
        return jsonResponse(plannedTask);
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "生成采购方案" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "确认方案，去授权" })).toBeTruthy();
    });

    // Click the done step 1 in the stepper → read-only review.
    fireEvent.click(screen.getByRole("button", { name: /提出问题/ }));
    expect(screen.getByText("提出你的研究问题")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "生成采购方案" })).toBeNull();
    expect(screen.getByText(/正在回看第 1 步/)).toBeTruthy();

    // Return to the current step.
    fireEvent.click(screen.getByRole("button", { name: "回到当前步骤" }));
    expect(screen.getByRole("button", { name: "确认方案，去授权" })).toBeTruthy();
  });
});
