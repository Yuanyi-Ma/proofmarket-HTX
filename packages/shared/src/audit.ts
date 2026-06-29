import type { AuditEvent, AuditResult, AuditSource } from "./types";

export function createAuditEvent(input: {
  id: string;
  taskId: string;
  source: AuditSource;
  type: string;
  result: AuditResult;
  message: string;
  createdAt: string;
  txHash?: string | null;
  policyId?: string | null;
  jobId?: number | null;
}): AuditEvent {
  return {
    id: input.id,
    taskId: input.taskId,
    source: input.source,
    type: input.type,
    result: input.result,
    message: input.message,
    txHash: input.txHash ?? null,
    policyId: input.policyId ?? null,
    jobId: input.jobId ?? null,
    createdAt: input.createdAt
  };
}
