import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
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
      : "Evidence summary appears after verifier acceptance.";

  return (
    <Section
      title="Final answer"
      kicker="Research agent synthesis"
      action={
        <button onClick={onSettle} disabled={!canSettle}>
          Release payment
        </button>
      }
    >
      <div className="answer-grid">
        <div className="data-row">
          <span className="data-label">Conclusion</span>
          <div>
            {challenged ? (
              <p className="tight">
                Cannot conclude from this provider package. The verifier found a
                coverage miss against the declared 2021-2026 execution
                acceleration scope.
              </p>
            ) : hasVerifiedAnswer ? (
              <p className="tight">
                Recent blockchain execution acceleration work centers on
                optimistic parallel execution, speculative execution, conflict
                detection, and state access optimization. The evidence supports
                these as important directions, but performance depends on
                conflict rate, state hotspots, storage, and deterministic
                scheduling.
              </p>
            ) : (
              <p className="tight">
                Waiting for verified evidence. The Research Agent will synthesize
                a final answer only after the verifier accepts the provider
                answer package.
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
                ? "Verified answer"
                : "Waiting for verification"}
          </StatusBadge>
        </div>
      </div>

      <div className="data-grid">
        <DataRow
          label="Evidence summary"
          value={
            challenged
              ? "Evidence summary is withheld from the normal answer because the package is under challenge."
              : evidenceSummary
          }
        />
        <DataRow
          label="Cannot conclude"
          value={
            hasVerifiedAnswer
              ? "The package does not prove global completeness, universal speedup, or that every workload benefits from parallel execution."
              : challenged
                ? "Cannot conclude from the challenged package until refund or slash is resolved."
                : "Cannot conclude before verifier acceptance."
          }
        />
        <DataRow
          label="Spend"
          value={
            task && (hasVerifiedAnswer || challenged)
              ? `Planned ${task.budgetLimit}; actual demo spend 1 test USDC; refund ${
                  task.status === "RefundedOrSlashed" ? "1 test USDC" : "0 test USDC"
                }.`
              : "Planned budget visible; actual spend waits for verification and settlement."
          }
        />
        <DataRow
          label="Payment and reputation"
          value={
            task?.status === "Settled"
              ? "Payment released to provider; reputation increase recorded."
              : task?.status === "RefundedOrSlashed"
                ? "Payment not released; provider reputation decrease recorded."
                : "Payment waits for verified evidence."
          }
        />
      </div>

      <div className="money-row">
        <span className="data-label">Release payment money action</span>
        <div className="small">
          Rule: verified provider package under active Pact. Target:
          ProofMarketEscrow settlement. Amount: 1 test USDC. Result:
          {task?.status === "Settled"
            ? " payment released and reputation increased."
            : " waiting for Release payment."}
        </div>
      </div>

      <p className="small muted tight">
        Report problem path: the demo challenge flow is CoverageMiss, shown when
        the shallow provider package is verified.
      </p>
    </Section>
  );
}
