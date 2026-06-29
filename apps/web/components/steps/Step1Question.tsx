import React, { useState } from "react";
import { getDefaultQuestion } from "@proofmarket/shared/src/fixtures";
import type { Task } from "@proofmarket/shared/src/types";
import type { Locale } from "@proofmarket/shared/src/locale";
import { displayAsset } from "../../lib/assets";
import { StepShell } from "../StepShell";
import { useI18n } from "../I18nProvider";

type Step1QuestionProps = {
  task: Task | null;
  onCreate: (question: string, budget: string, locale: Locale) => void;
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
  const { locale, t } = useI18n();
  const [question, setQuestion] = useState(getDefaultQuestion(locale));
  const [budget, setBudget] = useState("5 USDC");

  // When reviewing a done step, show what was actually submitted.
  const shownQuestion = readOnly && task ? task.userQuestion : question;
  const shownBudget = readOnly && task ? displayAsset(task.budgetLimit) : budget;

  return (
    <StepShell
      stepNo={1}
      title={t.step1.title}
      subtitle={t.step1.subtitle}
      primary={
        readOnly
          ? undefined
          : {
              label: t.step1.primary,
              onClick: () => onCreate(question, budget, locale),
              disabled: isBusy || question.trim() === "",
              busy: isBusy
            }
      }
    >
      <div className="form-grid">
        <label className="field">
          <span>{t.step1.question}</span>
          <textarea
            value={shownQuestion}
            disabled={readOnly || isBusy}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{t.step1.budget}</span>
          <input
            className="mono"
            value={shownBudget}
            disabled={readOnly || isBusy}
            onChange={(event) => setBudget(event.target.value)}
          />
          <span className="small muted">{t.step1.assetHint}</span>
        </label>
      </div>

      {readOnly ? (
        <div className="info-strip">{t.step1.readonly}</div>
      ) : (
        <div className="info-strip">
          {t.step1.hint}
        </div>
      )}
    </StepShell>
  );
}
