import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { DataRow, Section } from "./Section";
import { StatusBadge } from "./StatusBadge";

type EvidencePanelProps = {
  task: Task | null;
  onVerify: () => void;
  isBusy?: boolean;
};

function verificationStatus(task: Task | null): string {
  if (!task?.providerPackage) return "Waiting for provider package";
  if (task.status === "Verified" || task.status === "Settled") return "Verified";
  if (
    task.status === "Challenged" ||
    task.status === "ChallengeWon" ||
    task.status === "RefundedOrSlashed"
  ) {
    return "Challenged: CoverageMiss";
  }
  return "Pending verifier result";
}

export function EvidencePanel({
  task,
  onVerify,
  isBusy = false
}: EvidencePanelProps) {
  const providerPackage = task?.providerPackage;
  const canVerify = !isBusy && task?.status === "Delivered";

  return (
    <Section
      title="Evidence package"
      kicker="Verifiable deliverable"
      action={
        <button onClick={onVerify} disabled={!canVerify}>
          Verify evidence
        </button>
      }
    >
      <div className="info-strip">
        ProofMarket is not selling full documents. Providers return locators,
        excerpts or summaries, relevance explanations, coverage statements, and
        a package hash for audit.
      </div>

      <div className="data-grid">
        <DataRow
          label="Provider"
          value={providerPackage?.providerName ?? "Waiting for provider run"}
        />
        <DataRow
          label="Provider answer package"
          value={providerPackage ? providerPackage.providerId : "Not delivered"}
        />
        <DataRow
          label="Coverage statement"
          value={
            providerPackage?.coverageStatement ??
            "A delivered package must declare what scope it covered."
          }
        />
        <DataRow
          label="Verification status"
          value={
            <StatusBadge
              tone={
                verificationStatus(task).startsWith("Verified")
                  ? "success"
                  : verificationStatus(task).startsWith("Challenged")
                    ? "danger"
                    : "warning"
              }
            >
              {verificationStatus(task)}
            </StatusBadge>
          }
        />
        <DataRow
          label="Package hash"
          value={
            providerPackage ? (
              <span className="hash">{providerPackage.packageHash}</span>
            ) : (
              "Pending"
            )
          }
        />
        <DataRow
          label="Return type"
          value="Provider answer package, not source full text."
        />
      </div>

      <div className="evidence-list">
        {providerPackage?.answers.length ? (
          providerPackage.answers.map((answer) => (
            <article className="evidence-item" key={answer.sourceLocator}>
              <h3>{answer.sourceTitle}</h3>
              <div className="data-grid">
                <DataRow label="Provider answer" value={answer.providerAnswer} />
                <DataRow label="Source locator" value={answer.sourceLocator} />
                <DataRow
                  label="Year / type"
                  value={`${answer.sourceMetadata.year} / ${answer.sourceMetadata.type}`}
                />
                <DataRow
                  label="Excerpt or summary"
                  value={answer.excerptOrSummary}
                />
                <DataRow
                  label="Relevance"
                  value={answer.relevanceExplanation}
                />
                <DataRow
                  label="Coverage statement"
                  value={providerPackage.coverageStatement}
                />
                <DataRow
                  label="Per-item verification status"
                  value={
                    <StatusBadge
                      tone={
                        verificationStatus(task).startsWith("Verified")
                          ? "success"
                          : verificationStatus(task).startsWith("Challenged")
                            ? "danger"
                            : "warning"
                      }
                    >
                      {verificationStatus(task)}
                    </StatusBadge>
                  }
                />
                <DataRow
                  label="Per-item package hash"
                  value={
                    <span className="hash">{providerPackage.packageHash}</span>
                  }
                />
              </div>
            </article>
          ))
        ) : (
          <div className="info-strip">
            Run the expert or shallow provider after escrow funding to populate
            source locator, summary, relevance, coverage, and hash fields.
          </div>
        )}
      </div>
    </Section>
  );
}
