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
  "The provider claimed coverage of 2021-2026 blockchain transaction execution acceleration papers, but missed Block-STM, a directly relevant paper in the declared scope.";

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
  return match?.[1] ?? "Pending verifier result hash";
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
    "Provider original coverage statement appears after delivery.";

  return (
    <Section
      title="Challenge panel"
      kicker="Accountability path"
      action={
        isRealMode ? (
          <span className="small muted">
            Local mechanism demo — not available in real mode
          </span>
        ) : (
          <>
            <button
              className="secondary"
              onClick={onWinChallenge}
              disabled={!canWinChallenge}
            >
              Win challenge
            </button>
            <button
              className="danger"
              onClick={onRefundOrSlash}
              disabled={!canRefundOrSlash}
            >
              Refund or slash
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
        <DataRow label="Challenge reason" value={challengeText} />
        <DataRow
          label="Verifier verdict"
          value={verifier?.message ?? "Waiting for shallow package verification."}
        />
        <DataRow
          label="Refund or slash result"
          value={refund?.message ?? "Pending challenge win and settlement action."}
        />
        <DataRow
          label="Reputation change"
          value={
            task?.status === "RefundedOrSlashed"
              ? "Provider reputation decrease recorded."
              : "Pending verifier verdict."
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
              : "Challenge audit event pending."
          }
        />
        <DataRow
          label="Refund/slash money action"
          value={
            task?.status === "RefundedOrSlashed"
              ? "Rule: challenge won after provider fault. Target: ProofMarketEscrow slash path. Amount: 1 test USDC. Result: refund or provider slash executed."
              : "Rule: requires challenge win. Target: ProofMarketEscrow slash path. Amount: 1 test USDC. Result: waiting."
          }
        />
      </div>
    </Section>
  );
}
