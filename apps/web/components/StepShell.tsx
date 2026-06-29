"use client";

import React from "react";
import type { ReactNode } from "react";
import { useI18n } from "./I18nProvider";

export type StepAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
};

type StepShellProps = {
  stepNo: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  primary?: StepAction;
  secondary?: Omit<StepAction, "busy">;
};

export function StepShell({
  stepNo,
  title,
  subtitle,
  children,
  primary,
  secondary
}: StepShellProps) {
  const { locale } = useI18n();
  const stepLabel = locale === "zh" ? `第 ${stepNo} 步` : `Step ${stepNo}`;
  const ariaLabel = locale === "zh" ? `第 ${stepNo} 步：${title}` : `Step ${stepNo}: ${title}`;

  return (
    <section className="step-shell" aria-label={ariaLabel}>
      <header>
        <p className="step-kicker">{stepLabel}</p>
        <h2 className="step-title">{title}</h2>
        {subtitle ? <p className="step-subtitle">{subtitle}</p> : null}
      </header>

      <div className="step-body">{children}</div>

      {primary || secondary ? (
        <div className="step-actions">
          {primary ? (
            <button
              onClick={primary.onClick}
              disabled={primary.disabled || primary.busy}
              aria-busy={primary.busy ? "true" : undefined}
            >
              {primary.busy ? `${primary.label}…` : primary.label}
            </button>
          ) : null}
          {secondary ? (
            <button
              className="secondary"
              onClick={secondary.onClick}
              disabled={secondary.disabled}
            >
              {secondary.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
