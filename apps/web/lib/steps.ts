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
  { no: 1, key: "question", title: "提出问题" },
  { no: 2, key: "plan", title: "采购方案" },
  { no: 3, key: "authorize", title: "授权支付" },
  { no: 4, key: "purchase", title: "链上采购" },
  { no: 5, key: "verify", title: "证据核验" },
  { no: 6, key: "settle", title: "完成结算" }
];

// Status → wizard step. DeniedByCobo (and PactRejected) stay on step 3:
// they are authorization outcomes shown inside that step, not progress.
const stepByStatus: Record<TaskStatus, number> = {
  Created: 1,
  Planned: 2,
  PactSubmitted: 3,
  PactActive: 3,
  PactRejected: 3,
  DeniedByCobo: 3,
  JobFunded: 4,
  Delivered: 5,
  Verified: 5,
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
