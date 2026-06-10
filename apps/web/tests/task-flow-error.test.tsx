// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Page from "../app/page";
import type { Task } from "@proofmarket/shared/src/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const EXECUTE_ERROR = "Cobo transaction tx-approve (approve) failed with status failed";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status: "PactActive",
    budgetLimit: "5 test USDC",
    selectedProviderIds: [],
    plan: null,
    pact: {
      intent: "Fund one provider research job.",
      totalBudget: "5 mUSDC",
      perJobCap: "5 mUSDC",
      allowedTargets: ["ProofMarketEscrow", "MockUSDC"],
      allowedFunctions: ["approve", "createJob", "setBudget", "fund", "complete"],
      denyRules: ["direct transfers denied by default"],
      expiresInMinutes: 90,
      pactId: "p-1",
      status: "active"
    },
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

describe("error surfacing after a failed money action", () => {
  it("shows the route error AND the persisted failed txRecord after execute fails", async () => {
    const activeTask = task();
    const failedTask = task({
      txRecords: [{ label: "approve", coboTxId: "tx-approve", txHash: "", status: "failed" }],
      audit: [
        {
          id: "audit_001",
          taskId: "task_001",
          createdAt: "2026-01-01T00:00:01.000Z",
          source: "chain",
          type: "chain_tx_failed",
          result: "failed",
          message: `approve failed: ${EXECUTE_ERROR}`,
          txHash: null,
          pactId: "p-1",
          jobId: null
        }
      ]
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url === "/api/tasks") {
        return jsonResponse(activeTask, 200);
      }
      if (method === "POST" && url === "/api/tasks/task_001/execute") {
        return jsonResponse({ error: EXECUTE_ERROR }, 500);
      }
      if (method === "GET" && url === "/api/tasks/task_001") {
        return jsonResponse(failedTask, 200);
      }
      throw new Error(`unexpected fetch: ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    await waitFor(() => {
      const fund = screen.getByRole("button", { name: "Fund escrow" }) as HTMLButtonElement;
      expect(fund.disabled).toBe(false);
    });

    fireEvent.click(screen.getByRole("button", { name: "Fund escrow" }));

    // Error strip surfaces the JSON error from the 500 response
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(EXECUTE_ERROR)
    );

    // The follow-up GET refetched the task: the failed txRecord renders
    await waitFor(() => {
      expect(screen.getAllByText("approve").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("failed").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Cobo tx tx-approve").length).toBeGreaterThanOrEqual(1);
    });

    // One refetch happened after the failed POST
    const getCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init?.method ?? "GET") === "GET"
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(1);
  });
});
