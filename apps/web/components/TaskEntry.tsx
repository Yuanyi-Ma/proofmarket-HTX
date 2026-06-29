import React from "react";
import { defaultQuestion } from "@proofmarket/shared/src/fixtures";
import type { Task } from "@proofmarket/shared/src/types";
import { displayAsset } from "../lib/assets";
import { DataRow, Section } from "./Section";
import { TaskStatusBadge } from "./StatusBadge";

type TaskEntryProps = {
  task: Task | null;
  question?: string;
  budget?: string;
  onQuestionChange?: (value: string) => void;
  onBudgetChange?: (value: string) => void;
  onCreate: () => void;
  isBusy?: boolean;
};

export function TaskEntry({
  task,
  question = defaultQuestion,
  budget = "5 USDC",
  onQuestionChange,
  onBudgetChange,
  onCreate,
  isBusy = false
}: TaskEntryProps) {
  return (
    <Section
      title="Task Entry"
      kicker="Research Question"
      action={
        <button onClick={onCreate} disabled={isBusy}>
          {task ? "Create New Task" : "Create Task"}
        </button>
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>Question</span>
          <textarea
            value={question}
            onChange={(event) => onQuestionChange?.(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Budget limit</span>
          <input
            value={budget}
            onChange={(event) => onBudgetChange?.(event.target.value)}
          />
        </label>
      </div>

      <div className="info-strip">
        Submit a research question that needs evidence support. ProofMarket generates a bounded procurement plan before any funds move.
      </div>

      <div className="data-grid">
        <DataRow
          label="Current task"
          value={task ? `${task.id} created` : "No task yet"}
        />
        <DataRow
          label="Status"
          value={task ? <TaskStatusBadge status={task.status} /> : "Empty"}
        />
        <DataRow
          label="Payment context"
          value="A Policy Signer policy must be active before escrow funding."
        />
        <DataRow
          label="Payment asset"
          value={displayAsset(budget || "5 USDC")}
        />
      </div>
    </Section>
  );
}
