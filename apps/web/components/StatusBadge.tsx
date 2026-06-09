import React from "react";
import type { ReactNode } from "react";
import type { AuditResult, TaskStatus } from "@proofmarket/shared/src/types";

type Tone = "neutral" | "success" | "warning" | "danger";

const statusTone: Partial<Record<TaskStatus, Tone>> = {
  Created: "warning",
  Planned: "warning",
  PactSubmitted: "warning",
  PactActive: "success",
  JobFunded: "success",
  Delivered: "success",
  Verified: "success",
  Settled: "success",
  Audited: "success",
  Challenged: "danger",
  ChallengeWon: "danger",
  ChallengeLost: "warning",
  RefundedOrSlashed: "danger",
  PactRejected: "danger",
  DeniedByCobo: "danger"
};

const auditTone: Record<AuditResult, Tone> = {
  success: "success",
  pending: "warning",
  denied: "danger",
  failed: "danger"
};

function classFor(tone: Tone): string {
  return tone === "neutral" ? "status-badge" : `status-badge ${tone}`;
}

export function StatusBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={classFor(tone)}>{children}</span>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <StatusBadge tone={statusTone[status] ?? "neutral"}>{status}</StatusBadge>
  );
}

export function AuditResultBadge({ result }: { result: AuditResult }) {
  return <StatusBadge tone={auditTone[result]}>{result}</StatusBadge>;
}
