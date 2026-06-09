import type { TaskStatus } from "./types";

const transitions: Record<TaskStatus, TaskStatus[]> = {
  Created: ["Planned"],
  Planned: ["PactSubmitted"],
  PactSubmitted: ["PactActive", "PactRejected"],
  PactActive: ["JobFunded", "DeniedByCobo"],
  DeniedByCobo: ["JobFunded"],
  JobFunded: ["Delivered"],
  Delivered: ["Verified", "Challenged"],
  Verified: ["Settled"],
  Challenged: ["ChallengeWon", "ChallengeLost"],
  ChallengeWon: ["RefundedOrSlashed"],
  ChallengeLost: ["Settled"],
  Settled: ["Audited"],
  RefundedOrSlashed: ["Audited"],
  PactRejected: ["Audited"],
  Audited: []
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid ProofMarket transition: ${from} -> ${to}`);
  }
}
