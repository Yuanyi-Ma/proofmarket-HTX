"use client";

import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { STEPS, stepFor, stepStatus } from "../lib/steps";
import { useI18n } from "./I18nProvider";

type StepperProps = {
  task: Task | null;
  /** UI-only step while a slow action is in progress. */
  currentStep?: number | null;
  /** Step currently being reviewed read-only (a done step), if any. */
  viewingStep?: number | null;
  /** Called only for done steps; current/upcoming steps are not clickable. */
  onSelectStep?: (n: number) => void;
};

function statusFromCurrent(current: number, n: number) {
  if (n < current) return "done" as const;
  if (n === current) return "current" as const;
  return "upcoming" as const;
}

export function Stepper({
  task,
  currentStep = null,
  viewingStep = null,
  onSelectStep
}: StepperProps) {
  const { t } = useI18n();
  const current = currentStep ?? stepFor(task);

  return (
    <nav className="stepper" aria-label={t.steps.stepperAria}>
      <ol>
        {STEPS.map((step, index) => {
          const state =
            currentStep === null
              ? stepStatus(task, step.no)
              : statusFromCurrent(current, step.no);
          const viewing = viewingStep === step.no;
          const marker = state === "done" ? "✓" : String(step.no);
          const className = `stepper-item ${state}${viewing ? " viewing" : ""}`;
          const title = t.steps.labels[index] ?? step.title;

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
                  <span>{title}</span>
                </button>
              ) : (
                <span
                  className="stepper-link"
                  aria-current={state === "current" ? "step" : undefined}
                >
                  <span className="stepper-marker" aria-hidden="true">
                    {marker}
                  </span>
                  <span>{title}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
