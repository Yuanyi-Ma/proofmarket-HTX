import React from "react";
import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  kicker?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Section({ title, kicker, action, children }: SectionProps) {
  return (
    <section className="section">
      <div className="section-header">
        <div>
          {kicker ? <p className="section-kicker">{kicker}</p> : null}
          <h2 className="section-title">{title}</h2>
        </div>
        {action ? <div className="actions">{action}</div> : null}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function DataRow({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <div className="data-value">{value}</div>
    </div>
  );
}
