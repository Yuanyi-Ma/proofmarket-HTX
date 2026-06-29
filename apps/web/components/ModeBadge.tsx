import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { StatusBadge } from "./StatusBadge";
import { useI18n } from "./I18nProvider";

export function ModeBadge({ task }: { task: Task | null }) {
  const { t } = useI18n();

  if (!task) return null;

  return task.mode === "real" ? (
    <StatusBadge tone="success">{t.common.injectiveTestnet}</StatusBadge>
  ) : (
    <StatusBadge>{t.common.localSimulation}</StatusBadge>
  );
}
