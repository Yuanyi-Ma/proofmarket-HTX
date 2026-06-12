import React, { useState } from "react";
import type { AuditEvent, AuditResult, AuditSource, Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, sepoliaTxUrl } from "../lib/links";

const sourceLabels: Record<AuditSource, string> = {
  user: "用户",
  "research-agent": "研究 Agent",
  provider: "专家",
  verifier: "核验",
  cobo: "Cobo",
  chain: "链上",
  settlement: "结算"
};

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
        href={sepoliaTxUrl(event.txHash)}
        target="_blank"
        rel="noreferrer"
      >
        {event.txHash}
      </a>
    );
  }

  const fallback =
    event.txHash ?? event.pactId ?? (event.jobId !== null ? `job:${event.jobId}` : null);
  return fallback ? <span className="hash">{fallback}</span> : null;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("zh-CN", {
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
      aria-label="审计日志"
    >
      <div className="audit-sidebar-header">
        <h2>审计日志</h2>
        <button
          type="button"
          className="audit-toggle"
          aria-expanded={expanded}
          onClick={handleToggle}
        >
          {expanded ? "收起" : "展开"}
        </button>
      </div>

      {expanded ? (
        <div className="audit-sidebar-body">
          {denial ? (
            <details className="audit-denial-note">
              <summary>
                <span className="dot ok" aria-hidden="true" />
                Cobo 越权拦截记录 — 请求被策略引擎阻断，零资金流出
              </summary>
              <div className="audit-denial-body">
                <span className="small muted">
                  被拦截的动作：{denial.attemptedAction}（exit {denial.exitCode}）
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
                    <span>{sourceLabels[event.source] ?? event.source}</span>
                    <span className="muted">{formatTime(event.createdAt)}</span>
                  </div>
                  <span>{message.summary}</span>
                  {message.full ? (
                    <details className="audit-message-full">
                      <summary>查看完整记录</summary>
                      <p>{message.full}</p>
                    </details>
                  ) : null}
                  <EventHash event={event} />
                </article>
              );
            })
          ) : (
            <p className="small muted">尚无审计记录</p>
          )}
        </div>
      ) : null}
    </aside>
  );
}
