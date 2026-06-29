import type { Task, TaskStatus } from "@proofmarket/shared/src/types";

export type StepKey =
  | "question"
  | "plan"
  | "authorize"
  | "purchase"
  | "verify"
  | "settle";

export type StepDef = {
  no: number;
  key: StepKey;
  title: string;
};

export const STEPS: StepDef[] = [
  { no: 1, key: "question", title: "Ask" },
  { no: 2, key: "plan", title: "Procurement Plan" },
  { no: 3, key: "authorize", title: "Payment Authorization" },
  { no: 4, key: "purchase", title: "Purchase Execution" },
  { no: 5, key: "verify", title: "Verify Evidence" },
  { no: 6, key: "settle", title: "Settlement" }
];

// Status → wizard step. DeniedByPolicy (and PolicyRejected) stay on step 3:
// they are authorization outcomes shown inside that step, not progress.
const stepByStatus: Record<TaskStatus, number> = {
  Created: 1,
  Planned: 2,
  PolicySubmitted: 3,
  PolicyActive: 3,
  PolicyRejected: 3,
  DeniedByPolicy: 3,
  JobFunded: 4,
  Delivered: 5,
  Verified: 6,
  Challenged: 5,
  ChallengeWon: 5,
  ChallengeLost: 5,
  RefundedOrSlashed: 5,
  Settled: 6,
  Audited: 6
};

export function stepFor(task: Task | null): number {
  if (!task) return 1;
  return stepByStatus[task.status] ?? 1;
}

export type StepState = "done" | "current" | "upcoming";

export function stepStatus(task: Task | null, n: number): StepState {
  const current = stepFor(task);
  if (n < current) return "done";
  if (n === current) return "current";
  return "upcoming";
}
