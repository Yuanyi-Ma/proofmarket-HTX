import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { DataRow, Section } from "./Section";

type ProcurementPlanProps = {
  task: Task | null;
  onGenerate: () => void;
  isBusy?: boolean;
};

const defaultCoverage =
  "2021-2026 blockchain execution acceleration: parallel execution, speculative execution, conflict detection, state access, Block-STM, EVM parallelization, Sei, Sui, Solana runtime.";

export function ProcurementPlan({
  task,
  onGenerate,
  isBusy = false
}: ProcurementPlanProps) {
  const plan = task?.plan;
  const canGenerate = !isBusy && task?.status === "Created";

  return (
    <Section
      title="Procurement plan"
      kicker="Scope before spend"
      action={
        <button onClick={onGenerate} disabled={!canGenerate}>
          Generate procurement plan
        </button>
      }
    >
      <div className="data-grid">
        <DataRow
          label="Evidence need"
          value={
            plan?.evidenceNeed ??
            "Waiting for task creation. The plan will explain why external evidence is needed before execution."
          }
        />
        <DataRow
          label="Provider count"
          value={
            plan
              ? `${plan.providerCount} candidates, one recommended`
              : "Exactly three candidates will be shown."
          }
        />
        <DataRow
          label="Budget"
          value={
            plan
              ? `${plan.totalBudget} total cap, ${plan.perJobCap} per-provider cap`
              : "5 test USDC total cap, 1 test USDC per-provider cap"
          }
        />
        <DataRow
          label="Return type"
          value={plan?.returnType ?? "provider-answer-package"}
        />
        <DataRow
          label="Coverage"
          value={plan?.coverage ?? defaultCoverage}
        />
        <DataRow
          label="Verification"
          value={
            plan?.verificationMethod ??
            "Verifier checks locators, excerpts or summaries, relevance, and coverage."
          }
        />
      </div>
      <p className="small muted tight">
        The plan buys a bounded answer package and verification trail, not full
        documents or unrestricted wallet access.
      </p>
    </Section>
  );
}
