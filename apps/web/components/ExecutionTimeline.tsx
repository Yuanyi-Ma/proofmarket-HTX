import React from "react";
import type { TxRecord } from "@proofmarket/shared/src/realMode";
import type { Task, TaskStatus } from "@proofmarket/shared/src/types";
import { isFullTxHash, sepoliaTxUrl } from "../lib/links";
import { Section } from "./Section";
import { StatusBadge } from "./StatusBadge";

type DisplayState = TaskStatus | "ReturnedToEscrowPath";
type RowStatus = "past" | "current" | "waiting" | "not-taken";

type TimelineRow = {
  state: DisplayState;
  blocker: string;
};

const happyRows: TimelineRow[] = [
  { state: "Created", blocker: "waiting for procurement plan" },
  { state: "Planned", blocker: "waiting for user approval" },
  { state: "PactSubmitted", blocker: "waiting for Cobo activation" },
  { state: "PactActive", blocker: "waiting for escrow funding" },
  { state: "JobFunded", blocker: "waiting for provider delivery" },
  { state: "Delivered", blocker: "waiting for verifier result" },
  { state: "Verified", blocker: "waiting for payment release" },
  { state: "Settled", blocker: "settled" },
  { state: "Audited", blocker: "audited" }
];

const challengeRows: TimelineRow[] = [
  { state: "Delivered", blocker: "branch point after provider delivery" },
  { state: "Challenged", blocker: "waiting for challenge verdict" },
  { state: "ChallengeWon", blocker: "waiting for refund or slash" },
  { state: "RefundedOrSlashed", blocker: "settled by refund/slash" },
  { state: "Audited", blocker: "audited" }
];

const denialRows: TimelineRow[] = [
  { state: "PactActive", blocker: "agent attempted disallowed spend" },
  { state: "DeniedByCobo", blocker: "Cobo rejected transaction" },
  { state: "ReturnedToEscrowPath", blocker: "escrow can be funded next" }
];

const challengeStatuses: DisplayState[] = [
  "Challenged",
  "ChallengeWon",
  "RefundedOrSlashed"
];

function hasDenialAudit(task: Task): boolean {
  return task.audit.some((event) => event.type === "escrow_denied");
}

function hasChallengeAudit(task: Task): boolean {
  return task.audit.some((event) =>
    ["verification_failed", "challenge_won", "refund_or_slash"].includes(event.type)
  );
}

function isOnChallengeBranch(task: Task): boolean {
  return challengeStatuses.includes(task.status) || hasChallengeAudit(task);
}

function indexFor(rows: TimelineRow[], state: DisplayState): number {
  return rows.findIndex((row) => row.state === state);
}

function rowStatusFromIndex(index: number, currentIndex: number): RowStatus {
  if (index < currentIndex) return "past";
  if (index === currentIndex) return "current";
  return "waiting";
}

function happyStatus(task: Task | null, row: TimelineRow): RowStatus {
  if (!task) return "waiting";

  if (isOnChallengeBranch(task)) {
    const deliveredIndex = indexFor(happyRows, "Delivered");
    return rowStatusFromIndex(indexFor(happyRows, row.state), deliveredIndex);
  }

  if (task.status === "DeniedByCobo") {
    const pactIndex = indexFor(happyRows, "PactActive");
    return rowStatusFromIndex(indexFor(happyRows, row.state), pactIndex);
  }

  const currentIndex = indexFor(happyRows, task.status);
  if (currentIndex === -1) return "waiting";
  return rowStatusFromIndex(indexFor(happyRows, row.state), currentIndex);
}

function challengeStatus(task: Task | null, row: TimelineRow): RowStatus {
  if (!task || !isOnChallengeBranch(task)) return "not-taken";

  const currentIndex =
    task.status === "Audited" ? challengeRows.length - 1 : indexFor(challengeRows, task.status);
  return rowStatusFromIndex(indexFor(challengeRows, row.state), currentIndex);
}

function denialStatus(task: Task | null, row: TimelineRow): RowStatus {
  if (!task || (task.status !== "DeniedByCobo" && !hasDenialAudit(task))) {
    return "not-taken";
  }

  const currentIndex =
    task.status === "DeniedByCobo"
      ? indexFor(denialRows, "ReturnedToEscrowPath")
      : denialRows.length - 1;
  return rowStatusFromIndex(indexFor(denialRows, row.state), currentIndex);
}

function Row({ row, status }: { row: TimelineRow; status: RowStatus }) {
  return (
    <div className={`timeline-row ${status}`}>
      <div>
        <strong>{row.state}</strong>
        <p className="small muted tight">{row.blocker}</p>
      </div>
      <StatusBadge
        tone={
          status === "current"
            ? "success"
            : status === "not-taken"
              ? "neutral"
              : status === "past"
                ? "neutral"
                : "warning"
        }
      >
        {status}
      </StatusBadge>
    </div>
  );
}

function TimelineGroup({
  title,
  rows,
  statusFor
}: {
  title: string;
  rows: TimelineRow[];
  statusFor: (row: TimelineRow) => RowStatus;
}) {
  return (
    <div className="timeline-group">
      <h3>{title}</h3>
      <div className="timeline-list">
        {rows.map((row) => (
          <Row key={`${title}-${row.state}`} row={row} status={statusFor(row)} />
        ))}
      </div>
    </div>
  );
}

function shortHash(txHash: string): string {
  return `${txHash.slice(0, 10)}…${txHash.slice(-6)}`;
}

function TxRecordRow({ record }: { record: TxRecord }) {
  return (
    <div className={`timeline-row ${record.status === "confirmed" ? "past" : "current"}`}>
      <div>
        <strong>{record.label}</strong>
        {record.status === "confirmed" && isFullTxHash(record.txHash) ? (
          <p className="small tight">
            <a
              className="hash"
              href={sepoliaTxUrl(record.txHash)}
              target="_blank"
              rel="noreferrer"
            >
              {shortHash(record.txHash)}
            </a>
          </p>
        ) : (
          <p className="small muted tight">
            {record.coboTxId ? `Cobo tx ${record.coboTxId}` : "waiting for Cobo transaction"}
          </p>
        )}
      </div>
      <StatusBadge
        tone={
          record.status === "confirmed"
            ? "success"
            : record.status === "failed"
              ? "danger"
              : "warning"
        }
      >
        {record.status}
      </StatusBadge>
    </div>
  );
}

function TxRecordGroup({ records }: { records: TxRecord[] }) {
  if (!records.length) return null;

  return (
    <div className="timeline-group">
      <h3>Sepolia transactions</h3>
      <div className="timeline-list">
        {records.map((record, index) => (
          <TxRecordRow key={`${record.label}-${index}`} record={record} />
        ))}
      </div>
    </div>
  );
}

export function ExecutionTimeline({ task }: { task: Task | null }) {
  return (
    <Section title="Execution timeline" kicker="Actor state">
      <TxRecordGroup records={task?.txRecords ?? []} />
      <TimelineGroup
        title="Happy path"
        rows={happyRows}
        statusFor={(row) => happyStatus(task, row)}
      />
      <TimelineGroup
        title="Challenge branch"
        rows={challengeRows}
        statusFor={(row) => challengeStatus(task, row)}
      />
      <TimelineGroup
        title="Denial branch"
        rows={denialRows}
        statusFor={(row) => denialStatus(task, row)}
      />
    </Section>
  );
}
