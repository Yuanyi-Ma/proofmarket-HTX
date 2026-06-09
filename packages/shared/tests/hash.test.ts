import { describe, expect, it } from "vitest";
import { stableHash } from "../src/hash";

describe("stableHash", () => {
  it("returns the same hash when object keys are ordered differently", () => {
    const left = stableHash({ taskId: "task_001", amount: "1" });
    const right = stableHash({ amount: "1", taskId: "task_001" });
    expect(left).toBe(right);
    expect(left).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
