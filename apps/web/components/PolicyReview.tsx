import React from "react";
import type { PolicySummary, Task } from "@proofmarket/shared/src/types";
import { displayAllowedTarget, displayAsset } from "../lib/assets";
import { DataRow, Section } from "./Section";
import { StatusBadge } from "./StatusBadge";

type PolicyReviewProps = {
  task: Task | null;
  onSubmit: () => void;
  onFund: () => void;
  onTriggerDenial: () => void;
  onCheckApproval?: () => void;
  isBusy?: boolean;
};

const fallbackPolicy: PolicySummary = {
  intent: "Fund one Provider evidence-service job after the user confirms the transaction boundary.",
  totalBudget: "5 USDC",
  perJobCap: "1 USDC",
  allowedTargets: [
    "ProofMarketEscrow",
    "Injective USDC",
    "ProofMarketChallengeManager"
  ],
  allowedFunctions: ["createJob", "fund", "submit", "complete", "reject", "approve"],
  denyRules: [
    "direct transfer",
    "non-whitelisted target",
    "amount above cap",
    "expired policy"
  ],
  expiresInMinutes: 30,
  policyId: "pending",
  status: "draft"
};

export function PolicyReview({
  task,
  onSubmit,
  onFund,
  onTriggerDenial,
  onCheckApproval,
  isBusy = false
}: PolicyReviewProps) {
  const policy = task?.policy ?? fallbackPolicy;
  const isRealMode = task?.mode === "real";
  const awaitingApproval = isRealMode && task?.policy?.status === "submitted";
  const canSubmit = !isBusy && task?.status === "Planned";
  const canFund =
    !isBusy && (task?.status === "PolicyActive" || task?.status === "DeniedByPolicy");
  const canTriggerDenial = !isBusy && task?.status === "PolicyActive";
  const wasDenied = task?.status === "DeniedByPolicy";
  const wasFunded = Boolean(task?.jobId);

  return (
    <Section
      title="Policy Signer Policy"
      kicker="Transaction Boundary"
      action={
        <>
          <button onClick={onSubmit} disabled={!canSubmit}>
            Submit Policy
          </button>
          {awaitingApproval ? (
            <button
              className="secondary"
              onClick={onCheckApproval}
              disabled={isBusy}
            >
              Check Policy Activation
            </button>
          ) : null}
          <button className="secondary" onClick={onFund} disabled={!canFund}>
            Fund Escrow
          </button>
          <button
            className="danger"
            onClick={onTriggerDenial}
            disabled={!canTriggerDenial}
          >
            {isRealMode
              ? "Attempt Out-of-Bounds Transfer"
              : "Trigger Policy Signer Denial"}
          </button>
        </>
      }
    >
      <div className="data-grid">
        <DataRow label="Policy ID" value={policy.policyId} />
        <DataRow
          label="Policy status"
          value={
            <StatusBadge tone={policy.status === "active" ? "success" : "warning"}>
              {policy.status}
            </StatusBadge>
          }
        />
        <DataRow label="Intent" value={policy.intent} />
        <DataRow label="Expiry" value={`${policy.expiresInMinutes} minutes`} />
        <DataRow label="Total budget" value={displayAsset(policy.totalBudget)} />
        <DataRow label="Per-job cap" value={`<= ${displayAsset(policy.perJobCap)}`} />
        <DataRow label="Allowed contracts" value={policy.allowedTargets.map(displayAllowedTarget).join(", ")} />
        <DataRow label="Allowed functions" value={policy.allowedFunctions.join(", ")} />
        <DataRow label="Deny rules" value={policy.denyRules.join(", ")} />
      </div>

      <div className="two-col">
        <div className="money-row">
          <span className="data-label">Escrow funding action</span>
          <div className="small">
            Rule: policy active and amount within the per-call cap. Target: ProofMarketEscrow.
            Amount: 1 USDC. Result: escrow job funded without direct Provider transfer.
          </div>
        </div>
        <div className="money-row">
          <span className="data-label">Denial demo action</span>
          <div className="small">
            Rule: reject non-allowlisted contracts or overspend. Target: disallowed demo transaction.
            Amount: above the authorization cap. Result: refused before signing, with 0 USDC moved.
          </div>
        </div>
      </div>

      {awaitingApproval ? (
        <div className="info-strip">
          Wait for the Policy Signer policy to activate, then check again.
        </div>
      ) : null}

      {wasDenied ? (
        <div className="error-strip">
          Policy Signer denial recorded. The rejected transaction did not fund escrow or pay the Provider.
        </div>
      ) : null}

      {wasFunded ? (
        <div className="info-strip">
          Allowed transaction recorded on job #{task?.jobId}: policy allowed ProofMarketEscrow, amount 1 USDC, escrow funding complete.
        </div>
      ) : null}
    </Section>
  );
}
