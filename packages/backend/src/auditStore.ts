import type { AuditEvent, Task } from "@proofmarket/shared/src/types";

export function appendAudit(task: Task, event: AuditEvent): Task {
  return {
    ...task,
    audit: [...task.audit, event],
    updatedAt: new Date().toISOString()
  };
}
