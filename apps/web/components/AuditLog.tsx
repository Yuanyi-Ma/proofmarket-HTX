import React from "react";
import type { AuditEvent, Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, sepoliaTxUrl } from "../lib/links";
import { Section } from "./Section";
import { AuditResultBadge, StatusBadge } from "./StatusBadge";

const expectedReplayPoints = [
  "plan",
  "Pact",
  "allowed transaction",
  "denied transaction",
  "delivery hash",
  "verifier result",
  "settlement event",
  "challenge event"
];

function eventHash(event: AuditEvent): string {
  return event.txHash ?? event.pactId ?? (event.jobId ? `job:${event.jobId}` : event.id);
}

function EventHash({ event }: { event: AuditEvent }) {
  if (isFullTxHash(event.txHash)) {
    return (
      <a
        className="hash"
        href={sepoliaTxUrl(event.txHash)}
        target="_blank"
        rel="noreferrer"
      >
        {event.txHash}
      </a>
    );
  }

  return <span className="hash">{eventHash(event)}</span>;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function AuditLog({ task }: { task: Task | null }) {
  const events = task?.audit ?? [];
  const denial = task?.denial ?? null;

  return (
    <Section title="Audit log" kicker="Replay trail">
      <div className="badge-row">
        {expectedReplayPoints.map((point) => (
          <StatusBadge key={point}>{point}</StatusBadge>
        ))}
      </div>

      {denial ? (
        <div className="error-strip">
          <strong>Cobo denial record</strong>
          <p className="small tight">
            Attempted action: {denial.attemptedAction} ({`exit ${denial.exitCode}`})
          </p>
          <pre className="denial-output">{denial.rawOutput}</pre>
        </div>
      ) : null}

      <div className="audit-list">
        {events.length ? (
          events.map((event) => (
            <article className="audit-row" key={event.id}>
              <div className="audit-meta">
                <StatusBadge>{event.source}</StatusBadge>
                <AuditResultBadge result={event.result} />
                <span className="small muted">{formatTime(event.createdAt)}</span>
              </div>
              <strong>{event.type}</strong>
              <p className="small tight">{event.message}</p>
              <div className="small muted">
                Hash or transaction ID: <EventHash event={event} />
              </div>
            </article>
          ))
        ) : (
          <div className="info-strip">
            Audit rows will appear as the task records plan, Pact, allowed
            transaction, denied transaction, delivery hash, verifier result,
            settlement, and challenge events.
          </div>
        )}
      </div>
    </Section>
  );
}
