import { describe, expect, it } from "vitest";
import { createAuditEvent } from "../src/audit";

describe("createAuditEvent", () => {
  it("normalizes optional chain fields to null", () => {
    expect(
      createAuditEvent({
        id: "audit_001",
        taskId: "task_001",
        source: "provider",
        type: "package-created",
        result: "success",
        message: "Provider package created.",
        createdAt: "2026-01-01T00:00:00.000Z"
      })
    ).toEqual({
      id: "audit_001",
      taskId: "task_001",
      source: "provider",
      type: "package-created",
      result: "success",
      message: "Provider package created.",
      txHash: null,
      policyId: null,
      jobId: null,
      createdAt: "2026-01-01T00:00:00.000Z"
    });
  });
});
