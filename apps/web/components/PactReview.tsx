import React from "react";
import type { PactSummary, Task } from "@proofmarket/shared/src/types";
import { DataRow, Section } from "./Section";
import { StatusBadge } from "./StatusBadge";

type PactReviewProps = {
  task: Task | null;
  onSubmit: () => void;
  onFund: () => void;
  onTriggerDenial: () => void;
  onCheckApproval?: () => void;
  isBusy?: boolean;
};

const fallbackPact: PactSummary = {
  intent: "Fund one provider research job after the user inspects the boundary.",
  totalBudget: "5 test USDC",
  perJobCap: "1 test USDC",
  allowedTargets: [
    "ProofMarketEscrow",
    "MockUSDC",
    "ProofMarketChallengeManager"
  ],
  allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
  denyRules: [
    "direct transfer",
    "non-whitelisted target",
    "amount above cap",
    "expired pact"
  ],
  expiresInMinutes: 30,
  pactId: "pending",
  status: "draft"
};

export function PactReview({
  task,
  onSubmit,
  onFund,
  onTriggerDenial,
  onCheckApproval,
  isBusy = false
}: PactReviewProps) {
  const pact = task?.pact ?? fallbackPact;
  const isRealMode = task?.mode === "real";
  const awaitingApproval = isRealMode && task?.pact?.status === "submitted";
  const canSubmit = !isBusy && task?.status === "Planned";
  const canFund =
    !isBusy && (task?.status === "PactActive" || task?.status === "DeniedByCobo");
  const canTriggerDenial = !isBusy && task?.status === "PactActive";
  const wasDenied = task?.status === "DeniedByCobo";
  const wasFunded = Boolean(task?.jobId);

  return (
    <Section
      title="Cobo Pact"
      kicker="Spending boundary"
      action={
        <>
          <button onClick={onSubmit} disabled={!canSubmit}>
            Submit Pact
          </button>
          {awaitingApproval ? (
            <button
              className="secondary"
              onClick={onCheckApproval}
              disabled={isBusy}
            >
              Check Cobo approval
            </button>
          ) : null}
          <button className="secondary" onClick={onFund} disabled={!canFund}>
            Fund escrow
          </button>
          <button
            className="danger"
            onClick={onTriggerDenial}
            disabled={!canTriggerDenial}
          >
            {isRealMode
              ? "Attempt out-of-Pact transfer (real Cobo denial)"
              : "Trigger Cobo denial"}
          </button>
        </>
      }
    >
      <div className="data-grid">
        <DataRow label="Pact ID" value={pact.pactId} />
        <DataRow
          label="Pact status"
          value={
            <StatusBadge tone={pact.status === "active" ? "success" : "warning"}>
              {pact.status}
            </StatusBadge>
          }
        />
        <DataRow label="Intent" value={pact.intent} />
        <DataRow label="Expiry" value={`${pact.expiresInMinutes} minutes`} />
        <DataRow label="Total budget" value={pact.totalBudget} />
        <DataRow label="Per-job cap" value={`<= ${pact.perJobCap}`} />
        <DataRow label="Allowed targets" value={pact.allowedTargets.join(", ")} />
        <DataRow label="Allowed functions" value={pact.allowedFunctions.join(", ")} />
        <DataRow label="Deny rules" value={pact.denyRules.join(", ")} />
      </div>

      <div className="two-col">
        <div className="money-row">
          <span className="data-label">Fund escrow money action</span>
          <div className="small">
            Rule: per-job cap under active Pact. Target: ProofMarketEscrow.
            Amount: 1 test USDC. Result: escrow job funded, no direct provider
            transfer.
          </div>
        </div>
        <div className="money-row">
          <span className="data-label">Denial demo money action</span>
          <div className="small">
            Rule: deny non-whitelisted or over-cap spend. Target: disallowed
            demo transaction. Amount: above approved cap. Result: rejected by
            Cobo; moved funds: 0 test USDC.
          </div>
        </div>
      </div>

      {awaitingApproval ? (
        <div className="info-strip">
          Approve the Pact in your Cobo wallet, then check.
        </div>
      ) : null}

      {wasDenied ? (
        <div className="error-strip">
          Cobo rejection recorded. No escrow job was funded by the denied
          transaction and no provider payment moved.
        </div>
      ) : null}

      {wasFunded ? (
        <div className="info-strip">
          Allowed transaction recorded for job #{task?.jobId}: Pact rule
          allowed target ProofMarketEscrow, amount 1 test USDC, result
          funded escrow.
        </div>
      ) : null}
    </Section>
  );
}
