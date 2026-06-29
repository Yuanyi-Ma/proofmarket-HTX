import React, { useState } from "react";
import type { AuditEvent, AuditResult, AuditSource, Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, injectiveTxUrl } from "../lib/links";
import { useI18n } from "./I18nProvider";

const dotClass: Record<AuditResult, string> = {
  success: "dot ok",
  pending: "dot pending",
  failed: "dot danger",
  denied: "dot danger"
};

function EventHash({ event }: { event: AuditEvent }) {
  if (isFullTxHash(event.txHash)) {
    return (
      <a
        className="hash"
        href={injectiveTxUrl(event.txHash)}
        target="_blank"
        rel="noreferrer"
      >
        {event.txHash}
      </a>
    );
  }

  const fallback =
    event.txHash ?? event.policyId ?? (event.jobId !== null ? `job:${event.jobId}` : null);
  return fallback ? <span className="hash">{fallback}</span> : null;
}

function formatTime(value: string, locale: "en" | "zh"): string {
  return new Date(value).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function compactAuditMessage(message: string): { summary: string; full: string | null } {
  if (message.length <= 150) return { summary: message, full: null };
  return {
    summary: `${message.slice(0, 148)}…`,
    full: message
  };
}

type AuditSidebarProps = {
  task: Task | null;
  /** External control: when provided, overrides internal toggle state. */
  expanded?: boolean;
  onToggle?: (next: boolean) => void;
};

export function AuditSidebar({ task, expanded: expandedProp, onToggle }: AuditSidebarProps) {
  const { locale, t } = useI18n();
  const [internalExpanded, setInternalExpanded] = useState(true);
  // Controlled if expandedProp is provided; uncontrolled otherwise.
  const expanded = expandedProp !== undefined ? expandedProp : internalExpanded;

  function handleToggle() {
    const next = !expanded;
    if (onToggle) {
      onToggle(next);
    } else {
      setInternalExpanded(next);
    }
  }
  const events = task?.audit ?? [];
  const denial = task?.denial ?? null;

  return (
    <aside
      className={`audit-sidebar${expanded ? "" : " collapsed"}`}
      aria-label={t.audit.sidebarAria}
    >
      <div className="audit-sidebar-header">
        <h2>{t.audit.title}</h2>
        <button
          type="button"
          className="audit-toggle"
          aria-expanded={expanded}
          onClick={handleToggle}
        >
          {expanded ? t.common.collapse : t.common.expand}
        </button>
      </div>

      {expanded ? (
        <div className="audit-sidebar-body">
          {denial ? (
            <details className="audit-denial-note">
              <summary>
                <span className="dot ok" aria-hidden="true" />
                {t.audit.denialSummary}
              </summary>
              <div className="audit-denial-body">
                <span className="small muted">
                  {t.audit.blockedAction}: {denial.attemptedAction} (exit {denial.exitCode})
                </span>
                <pre className="denial-output">{denial.rawOutput}</pre>
              </div>
            </details>
          ) : null}

          {events.length ? (
            events.map((event) => {
              const message = compactAuditMessage(event.message);
              return (
                <article className="audit-event" key={event.id}>
                  <div className="audit-event-meta">
                    <span className={dotClass[event.result]} aria-hidden="true" />
                    <span>{t.audit.sourceLabels[event.source] ?? event.source}</span>
                    <span className="muted">{formatTime(event.createdAt, locale)}</span>
                  </div>
                  <span>{message.summary}</span>
                  {message.full ? (
                    <details className="audit-message-full">
                      <summary>{t.audit.fullRecord}</summary>
                      <p>{message.full}</p>
                    </details>
                  ) : null}
                  <EventHash event={event} />
                </article>
              );
            })
          ) : (
            <p className="small muted">{t.common.noRecords}</p>
          )}
        </div>
      ) : null}
    </aside>
  );
}
