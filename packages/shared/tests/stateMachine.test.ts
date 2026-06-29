import { describe, expect, it } from "vitest";
import { canTransition } from "../src/stateMachine";

describe("ProofMarket task state machine", () => {
  it("allows the happy path transitions", () => {
    expect(canTransition("Created", "Planned")).toBe(true);
    expect(canTransition("Planned", "PolicySubmitted")).toBe(true);
    expect(canTransition("PolicySubmitted", "PolicyActive")).toBe(true);
    expect(canTransition("PolicyActive", "JobFunded")).toBe(true);
    expect(canTransition("JobFunded", "Delivered")).toBe(true);
    expect(canTransition("Delivered", "Verified")).toBe(true);
    expect(canTransition("Verified", "Settled")).toBe(true);
    expect(canTransition("Settled", "Audited")).toBe(true);
  });

  it("allows the policy signer denial branch to return to escrow path", () => {
    expect(canTransition("PolicyActive", "DeniedByPolicy")).toBe(true);
    expect(canTransition("DeniedByPolicy", "JobFunded")).toBe(true);
  });

  it("rejects impossible transitions", () => {
    expect(canTransition("Created", "Settled")).toBe(false);
    expect(canTransition("Verified", "Challenged")).toBe(false);
  });
});
