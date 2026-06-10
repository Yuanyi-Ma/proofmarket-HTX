import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { StatusBadge } from "./StatusBadge";

export function ModeBadge({ task }: { task: Task | null }) {
  if (!task) return null;

  return task.mode === "real" ? (
    <StatusBadge tone="warning">真链模式 · Sepolia</StatusBadge>
  ) : (
    <StatusBadge>演示模式（fixture）</StatusBadge>
  );
}
