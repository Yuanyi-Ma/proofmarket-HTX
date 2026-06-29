import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { displayAsset } from "../lib/assets";
import { DataRow, Section } from "./Section";
import { StatusBadge } from "./StatusBadge";

type FinalAnswerProps = {
  task: Task | null;
  onSettle: () => void;
  isBusy?: boolean;
};

function isChallengeState(task: Task | null): boolean {
  return (
    task?.status === "Challenged" ||
    task?.status === "ChallengeWon" ||
    task?.status === "RefundedOrSlashed"
  );
}

export function FinalAnswer({
  task,
  onSettle,
  isBusy = false
}: FinalAnswerProps) {
  const providerPackage = task?.providerPackage;
  const canSettle = !isBusy && task?.status === "Verified";
  const hasVerifiedAnswer = task?.status === "Verified" || task?.status === "Settled";
  const challenged = isChallengeState(task);
  const evidenceSummary =
    providerPackage?.answers.length && hasVerifiedAnswer
      ? providerPackage.answers
          .slice(0, 3)
          .map((answer) => `${answer.sourceTitle}: ${answer.excerptOrSummary}`)
          .join(" ")
      : "Source summary appears after verification.";

  return (
    <Section
      title="Final Answer"
      kicker="Agent Synthesis"
      action={
        <button onClick={onSettle} disabled={!canSettle}>
          Settle Payment
        </button>
      }
    >
      <div className="answer-grid">
        <div className="data-row">
          <span className="data-label">Conclusion</span>
          <div>
            {challenged ? (
              <p className="tight">
                No conclusion can be drawn from this Evidence Service Package. Verification found a missing in-scope 2021-2026 execution acceleration source.
              </p>
            ) : hasVerifiedAnswer ? (
              <p className="tight">
                Recent blockchain execution acceleration work centers on optimistic parallel execution, speculative execution, conflict detection, and state-access optimization. Evidence supports their importance, while performance still depends on conflict rate, state hotspots, storage, and deterministic scheduling.
              </p>
            ) : (
              <p className="tight">
                Waiting for evidence verification. The Agent synthesizes a final answer only after the package passes verification.
              </p>
            )}
          </div>
        </div>

        <div className="data-row">
          <span className="data-label">Answer status</span>
          <StatusBadge
            tone={
              challenged
                ? "danger"
                : hasVerifiedAnswer
                  ? "success"
                  : "warning"
            }
          >
            {challenged
              ? "Challenged"
              : hasVerifiedAnswer
                ? "Verified"
                : "Waiting for verification"}
          </StatusBadge>
        </div>
      </div>

      <div className="data-grid">
        <DataRow
          label="Source summary"
          value={
            challenged
              ? "The Evidence Service Package is in a challenge flow; no normal answer is generated yet."
              : evidenceSummary
          }
        />
        <DataRow
          label="Cannot conclude"
          value={
            hasVerifiedAnswer
              ? "The Evidence Service Package cannot prove global completeness, universal acceleration, or that every workload benefits from parallel execution."
              : challenged
                ? "No conclusion can be drawn from the challenged package before refund or slash execution completes."
                : "No conclusion can be drawn before verification passes."
          }
        />
        <DataRow
          label="Spend"
          value={
            task && (hasVerifiedAnswer || challenged)
              ? `Planned budget ${displayAsset(task.budgetLimit)}; actual spend 1 USDC; refund ${
                  task.status === "RefundedOrSlashed" ? "1 USDC" : "0 USDC"
                }.`
              : "Planned budget is shown; actual spend waits for verification and settlement."
          }
        />
        <DataRow
          label="Payment and reputation"
          value={
            task?.status === "Settled"
              ? "Payment released to the Provider; reputation feedback recorded."
              : task?.status === "RefundedOrSlashed"
                ? "Payment not released; Provider reputation decrease recorded."
                : "Payment waits for evidence verification."
          }
        />
      </div>

      <div className="money-row">
        <span className="data-label">Settlement funds action</span>
        <div className="small">
          Rule: policy active and Evidence Service Package verified. Target:
          ProofMarketEscrow settlement path. Amount: 1 USDC. Result:
          {task?.status === "Settled"
            ? " payment released and reputation feedback recorded."
            : " waiting for settlement payment."}
        </div>
      </div>

      <p className="small muted tight">
        If a problem is found, the challenge path handles it: a low-quality Provider package triggers an in-scope coverage-miss example.
      </p>
    </Section>
  );
}
