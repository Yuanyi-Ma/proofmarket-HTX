import React from "react";
import type { AuditEvent, Task } from "@proofmarket/shared/src/types";
import { DataRow, Section } from "./Section";
import { StatusBadge } from "./StatusBadge";

type ChallengePanelProps = {
  task: Task | null;
  onWinChallenge: () => void;
  onRefundOrSlash: () => void;
  isBusy?: boolean;
};

const challengeText =
  "The Provider committed to cover 2021-2026 blockchain transaction execution acceleration papers but missed Block-STM, a directly relevant in-scope paper.";

function verifierEvent(task: Task | null): AuditEvent | undefined {
  return task?.audit.find((event) => event.type === "verification_failed");
}

function challengeEvent(task: Task | null): AuditEvent | undefined {
  return task?.audit.find((event) => event.type === "challenge_won");
}

function refundEvent(task: Task | null): AuditEvent | undefined {
  return task?.audit.find((event) => event.type === "refund_or_slash");
}

function resultHash(message: string | undefined): string {
  const match = message?.match(/resultHash=([^ ]+)/);
  return match?.[1] ?? "Waiting for verification result hash";
}

export function ChallengePanel({
  task,
  onWinChallenge,
  onRefundOrSlash,
  isBusy = false
}: ChallengePanelProps) {
  const isRealMode = task?.mode === "real";
  const canWinChallenge = !isBusy && task?.status === "Challenged";
  const canRefundOrSlash = !isBusy && task?.status === "ChallengeWon";
  const verifier = verifierEvent(task);
  const challenge = challengeEvent(task);
  const refund = refundEvent(task);
  const providerCoverage =
    task?.providerPackage?.coverageStatement ??
    "The Provider's original coverage commitment appears after delivery.";

  return (
    <Section
      title="Challenge Panel"
      kicker="Accountability Path"
      action={
        isRealMode ? (
          <span className="small muted">
            Local mechanism demo; unavailable in real mode
          </span>
        ) : (
          <>
            <button
              className="secondary"
              onClick={onWinChallenge}
              disabled={!canWinChallenge}
            >
              Uphold Challenge
            </button>
            <button
              className="danger"
              onClick={onRefundOrSlash}
              disabled={!canRefundOrSlash}
            >
              Refund or Slash
            </button>
          </>
        )
      }
    >
      <div className="data-grid">
        <DataRow
          label="Challenge type"
          value={<StatusBadge tone="danger">CoverageMiss</StatusBadge>}
        />
        <DataRow label="Missing evidence" value="Block-STM, arXiv:2203.06871" />
        <DataRow
          label="Provider original coverage"
          value={providerCoverage}
        />
        <DataRow label="Challenge rationale" value={challengeText} />
        <DataRow
          label="Verification result"
          value={verifier?.message ?? "Waiting for Evidence Service Package verification."}
        />
        <DataRow
          label="Refund or slash result"
          value={refund?.message ?? "Waiting for challenge verdict and settlement action."}
        />
        <DataRow
          label="Reputation change"
          value={
            task?.status === "RefundedOrSlashed"
              ? "Provider reputation decrease recorded."
              : "Waiting for verification result."
          }
        />
        <DataRow
          label="Challenge hash"
          value={<span className="hash">{resultHash(verifier?.message)}</span>}
        />
        <DataRow
          label="Audit event"
          value={
            challenge
              ? `${challenge.id}: ${challenge.message}`
              : "Waiting for challenge audit event."
          }
        />
        <DataRow
          label="Refund / slash funds action"
          value={
            task?.status === "RefundedOrSlashed"
              ? "Rule: challenge upheld due to Provider fault. Target: ProofMarketEscrow slash path. Amount: 1 USDC. Result: refund or slash executed."
              : "Rule: challenge must be upheld first. Target: ProofMarketEscrow slash path. Amount: 1 USDC. Result: waiting for execution."
          }
        />
      </div>
    </Section>
  );
}
