import React, { useState } from "react";
import { defaultQuestion } from "@proofmarket/shared/src/fixtures";
import type { Task } from "@proofmarket/shared/src/types";
import { StepShell } from "../StepShell";

type Step1QuestionProps = {
  task: Task | null;
  onCreate: (question: string, budget: string) => void;
  isBusy?: boolean;
  /** True when reviewing this step after it is done: inputs frozen, no action. */
  readOnly?: boolean;
};

export function Step1Question({
  task,
  onCreate,
  isBusy = false,
  readOnly = false
}: Step1QuestionProps) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [budget, setBudget] = useState("5 mUSDC");

  // When reviewing a done step, show what was actually submitted.
  const shownQuestion = readOnly && task ? task.userQuestion : question;
  const shownBudget = readOnly && task ? task.budgetLimit : budget;

  return (
    <StepShell
      stepNo={1}
      title="提出你的研究问题"
      subtitle="描述你需要专家支持的问题，并设定预算上限。Agent 会在预算内委托领域专家，产出可核验的研究简报。"
      primary={
        readOnly
          ? undefined
          : {
              label: "生成委托方案",
              onClick: () => onCreate(question, budget),
              disabled: isBusy || question.trim() === "",
              busy: isBusy
            }
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>研究问题</span>
          <textarea
            value={shownQuestion}
            disabled={readOnly || isBusy}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <label className="field">
          <span>预算上限</span>
          <input
            className="mono"
            value={shownBudget}
            disabled={readOnly || isBusy}
            onChange={(event) => setBudget(event.target.value)}
          />
          <span className="small muted">mUSDC = 测试网 USDC（MockUSDC）</span>
        </label>
      </div>

      {readOnly ? (
        <div className="info-strip">该问题已提交，此处为只读回看。</div>
      ) : (
        <div className="info-strip">
          提交后，Agent 会先给出一份有边界的委托方案——在任何资金移动之前，你都能看到钱花在哪、花多少。
        </div>
      )}
    </StepShell>
  );
}
