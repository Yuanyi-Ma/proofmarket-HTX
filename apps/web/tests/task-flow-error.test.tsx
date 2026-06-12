// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "../app/console/page";
import type { ProcurementPlan, Task } from "@proofmarket/shared/src/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const PACT_ERROR = "Cobo pact submission failed: policy service unavailable";

const plan: ProcurementPlan = {
  taskId: "task_001",
  userQuestion: "Question",
  evidenceNeed: "Need primary sources on execution acceleration.",
  totalBudget: "5 test USDC",
  perJobCap: "1 test USDC",
  recommendedProviderId: "execution-research-expert",
  providerCount: 3,
  coverage: "Block-STM, parallel execution.",
  verificationMethod: "Verifier checks locators and excerpts.",
  returnType: "provider-answer-package"
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
    mode: "real",
    txRecords: [],
    claudePlanRaw: null,
    denial: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("error surfacing after a failed action", () => {
  it("shows the route error AND the persisted audit failure after pact fails", async () => {
    const plannedTask = task({ status: "Planned", plan });
    const failedTask = task({
      status: "Planned",
      plan,
      audit: [
        {
          id: "audit_001",
          taskId: "task_001",
          createdAt: "2026-01-01T00:00:01.000Z",
          source: "cobo",
          type: "pact_failed",
          result: "failed",
          message: `pact failed: ${PACT_ERROR}`,
          txHash: null,
          pactId: null,
          jobId: null
        }
      ]
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url === "/api/tasks") {
        return jsonResponse(task(), 200);
      }
      if (method === "POST" && url === "/api/tasks/task_001/plan") {
        return jsonResponse(plannedTask, 200);
      }
      if (method === "POST" && url === "/api/tasks/task_001/pact") {
        return jsonResponse({ error: PACT_ERROR }, 500);
      }
      if (method === "GET" && url === "/api/tasks/task_001") {
        return jsonResponse(failedTask, 200);
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Page />);

    // Step 1 → auto plan-chain → step 2.
    fireEvent.click(screen.getByRole("button", { name: "生成购买方案" }));
    await waitFor(() => {
      const confirm = screen.getByRole("button", {
        name: "确认方案，去授权"
      }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "确认方案，去授权" }));

    // Error strip surfaces the JSON error from the 500 response.
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(PACT_ERROR)
    );

    fireEvent.click(screen.getByRole("button", { name: "展开" }));

    // The follow-up GET refetched the task: the persisted audit failure
    // renders in the audit sidebar (source label + message).
    await waitFor(() => {
      expect(screen.getByText(`pact failed: ${PACT_ERROR}`)).toBeTruthy();
      expect(screen.getAllByText("Cobo").length).toBeGreaterThanOrEqual(1);
    });

    // One refetch happened after the failed POST.
    const getCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init?.method ?? "GET") === "GET"
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(1);
  });
});
