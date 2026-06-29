// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "../app/console/page";
import type { ProcurementPlan, Task } from "@proofmarket/shared/src/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const plan: ProcurementPlan = {
  taskId: "task_001",
  userQuestion: "Question",
  evidenceNeed: "Needs primary 2021-2026 execution acceleration literature evidence, not secondary surveys.",
  totalBudget: "5 USDC",
  perJobCap: "1 USDC",
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
    budgetLimit: "5 USDC",
    selectedProviderIds: [],
    plan: null,
    policy: null,
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
  it("starts on step 1 with the question form and collapsed audit state", () => {
    render(<Page />);

    expect(screen.getByText("Ask Your Research Question")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate Procurement Plan" })).toBeTruthy();
    expect(screen.getByText("Audit Log")).toBeTruthy();
    expect(screen.queryByText("No audit records yet")).toBeNull();
    expect(screen.getByRole("button", { name: "Expand" })).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Generate Procurement Plan" }));

    // Step 2 renders the recommendation, the real Claude reason, and the
    // confirm action.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm Plan and Authorize" })).toBeTruthy();
    });
    expect(screen.getAllByText("Blockchain Systems Evidence Agent").length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole("button", { name: "Generate Procurement Plan" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Confirm Plan and Authorize" })).toBeTruthy();
    });

    // Click the done step 1 in the stepper → read-only review.
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    expect(screen.getByText("Ask Your Research Question")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Generate Procurement Plan" })).toBeNull();
    expect(screen.getByText(/Reviewing step 1 read-only/)).toBeTruthy();

    // Return to the current step.
    fireEvent.click(screen.getByRole("button", { name: "Back to current step" }));
    expect(screen.getByRole("button", { name: "Confirm Plan and Authorize" })).toBeTruthy();
  });
});
