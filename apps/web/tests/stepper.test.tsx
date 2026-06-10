// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Stepper } from "../components/Stepper";
import { STEPS } from "../lib/steps";
import type { Task, TaskStatus } from "@proofmarket/shared/src/types";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function task(status: TaskStatus): Task {
  return {
    id: "task_001",
    userQuestion: "Question",
    status,
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
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

afterEach(cleanup);

describe("Stepper", () => {
  it("renders all six Chinese step titles", () => {
    render(<Stepper task={null} />);

    for (const step of STEPS) {
      expect(screen.getByText(step.title)).toBeTruthy();
    }
  });

  it("marks the current step via aria-current", () => {
    render(<Stepper task={task("JobFunded")} />); // step 4

    const current = document.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain("链上采购");
  });

  it("makes done steps clickable and current/upcoming not", () => {
    const onSelectStep = vi.fn();
    render(<Stepper task={task("JobFunded")} onSelectStep={onSelectStep} />);

    // Done steps (1-3) render as buttons.
    fireEvent.click(screen.getByRole("button", { name: /采购方案/ }));
    expect(onSelectStep).toHaveBeenCalledWith(2);

    // Current (4) and upcoming (5, 6) are not buttons.
    expect(screen.queryByRole("button", { name: /链上采购/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /证据核验/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /完成结算/ })).toBeNull();
  });

  it("shows a check marker for done steps", () => {
    render(<Stepper task={task("Planned")} onSelectStep={vi.fn()} />); // step 2

    const doneButton = screen.getByRole("button", { name: /提出问题/ });
    expect(doneButton.textContent).toContain("✓");
  });
});
