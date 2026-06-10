import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { STEPS, stepStatus } from "../lib/steps";

type StepperProps = {
  task: Task | null;
  /** Step currently being reviewed read-only (a done step), if any. */
  viewingStep?: number | null;
  /** Called only for done steps; current/upcoming steps are not clickable. */
  onSelectStep?: (n: number) => void;
};

export function Stepper({ task, viewingStep = null, onSelectStep }: StepperProps) {
  return (
    <nav className="stepper" aria-label="流程步骤">
      <ol>
        {STEPS.map((step) => {
          const state = stepStatus(task, step.no);
          const viewing = viewingStep === step.no;
          const marker = state === "done" ? "✓" : String(step.no);
          const className = `stepper-item ${state}${viewing ? " viewing" : ""}`;

          return (
            <li className={className} key={step.no}>
              {state === "done" && onSelectStep ? (
                <button
                  type="button"
                  className="stepper-link"
                  onClick={() => onSelectStep(step.no)}
                >
                  <span className="stepper-marker" aria-hidden="true">
                    {marker}
                  </span>
                  <span>{step.title}</span>
                </button>
              ) : (
                <span
                  className="stepper-link"
                  aria-current={state === "current" ? "step" : undefined}
                >
                  <span className="stepper-marker" aria-hidden="true">
                    {marker}
                  </span>
                  <span>{step.title}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
