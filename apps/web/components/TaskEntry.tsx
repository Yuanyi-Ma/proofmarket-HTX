import React from "react";
import { defaultQuestion } from "@proofmarket/shared/src/fixtures";
import type { Task } from "@proofmarket/shared/src/types";
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
  budget = "5 test USDC",
  onQuestionChange,
  onBudgetChange,
  onCreate,
  isBusy = false
}: TaskEntryProps) {
  return (
    <Section
      title="Task entry"
      kicker="Research question"
      action={
        <button onClick={onCreate} disabled={isBusy}>
          {task ? "Create fresh task" : "Create task"}
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
        Ask one research question that needs evidence. ProofMarket will propose
        a bounded procurement plan before any funds move. Next action after
        task creation: Generate procurement plan.
      </div>

      <div className="data-grid">
        <DataRow
          label="Current task"
          value={task ? `${task.id} created` : "No task created yet"}
        />
        <DataRow
          label="Status"
          value={task ? <TaskStatusBadge status={task.status} /> : "Empty"}
        />
        <DataRow
          label="Payment context"
          value="Execution requires a Cobo Pact before escrow funding."
        />
        <DataRow
          label="Demo asset"
          value={budget || "5 test USDC"}
        />
      </div>
    </Section>
  );
}
