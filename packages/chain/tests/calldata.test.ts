import { describe, expect, it } from "vitest";
import {
  encodeApprove,
  encodeCreateJob,
  encodeSetBudget,
  encodeFund,
  encodeComplete,
  encodeSubmit
} from "../src/calldata";

const addr = (c: string) => `0x${c.repeat(40)}` as `0x${string}`;
const hash32 = (c: string) => `0x${c.repeat(64)}` as `0x${string}`;

describe("calldata encoding", () => {
  it("encodes approve(spender, amount)", () => {
    const data = encodeApprove(addr("4"), 5_000_000n);
    expect(data.startsWith("0x095ea7b3")).toBe(true); // approve selector
  });

  it("encodes createJob with 8 args", () => {
    const data = encodeCreateJob({
      providerAgentId: 1n,
      provider: addr("a"),
      verifierAgentId: 2n,
      evaluator: addr("b"),
      token: addr("3"),
      expiredAt: 1_900_000_000n,
      descriptionHash: hash32("1"),
      coverageHash: hash32("2")
    });
    expect(data.length).toBe(2 + 8 + 8 * 64); // selector + 8 words
  });

  it("encodes setBudget, fund, complete, submit", () => {
    expect(encodeSetBudget(1n, 5_000_000n).length).toBe(2 + 8 + 2 * 64);
    expect(encodeFund(1n, 5_000_000n).length).toBe(2 + 8 + 2 * 64);
    expect(encodeComplete(1n, hash32("3")).length).toBe(2 + 8 + 2 * 64);
    expect(encodeSubmit(1n, hash32("4")).length).toBe(2 + 8 + 2 * 64);
  });
});
