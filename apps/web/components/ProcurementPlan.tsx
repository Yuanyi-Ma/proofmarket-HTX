import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { displayAsset } from "../lib/assets";
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
      title="Procurement Plan"
      kicker="Scope Before Spend"
      action={
        <button onClick={onGenerate} disabled={!canGenerate}>
          Generate Procurement Plan
        </button>
      }
    >
      <div className="data-grid">
        <DataRow
          label="Evidence need"
          value={
            plan?.evidenceNeed ??
            "Waiting for task creation. The procurement plan explains why external evidence service is needed before execution."
          }
        />
        <DataRow
          label="Provider candidates"
          value={
            plan
              ? `${plan.providerCount} candidates, 1 recommended`
              : "Three Provider candidates will be shown."
          }
        />
        <DataRow
          label="Budget"
          value={
            plan
              ? `Total budget cap ${displayAsset(plan.totalBudget)}, per-Provider cap ${displayAsset(plan.perJobCap)}`
              : "Total budget cap 5 USDC, per-Provider cap 1 USDC"
          }
        />
        <DataRow
          label="Deliverable type"
          value={plan?.returnType ?? "Evidence Service Package"}
        />
        <DataRow
          label="Coverage commitment"
          value={plan?.coverage ?? defaultCoverage}
        />
        <DataRow
          label="Verification method"
          value={
            plan?.verificationMethod ??
            "Verify source locators, excerpts or summaries, relevance, and coverage commitment."
          }
        />
      </div>
      <p className="small muted tight">
        The procurement plan buys a bounded Evidence Service Package and verifiable records. Full source text and unrestricted signing authority never enter the transaction.
      </p>
    </Section>
  );
}
