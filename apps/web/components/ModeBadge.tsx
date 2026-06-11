import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { StatusBadge } from "./StatusBadge";

export function ModeBadge({ task }: { task: Task | null }) {
  if (!task) return null;

  return task.mode === "real" ? (
    <StatusBadge tone="success">Sepolia 测试网</StatusBadge>
  ) : (
    <StatusBadge>本地模拟</StatusBadge>
  );
}
