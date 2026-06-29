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
  if (!task?.providerPackage) return "Waiting for Provider delivery";
  if (task.status === "Verified" || task.status === "Settled") return "Verified";
  if (
    task.status === "Challenged" ||
    task.status === "ChallengeWon" ||
    task.status === "RefundedOrSlashed"
  ) {
    return "Challenged: in-scope coverage miss";
  }
  return "Waiting for verification result";
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
      title="Evidence Service Package"
      kicker="Verifiable Deliverable"
      action={
        <button onClick={onVerify} disabled={!canVerify}>
          Verify Evidence
        </button>
      }
    >
      <div className="info-strip">
        ProofMarket buys an Evidence Service Package. The Provider returns source locators, bounded excerpts or summaries, relevance explanations, coverage commitment, and an auditable package hash.
      </div>

      <div className="data-grid">
        <DataRow
          label="Provider"
          value={providerPackage?.providerName ?? "Waiting for Provider execution"}
        />
        <DataRow
          label="Evidence Service Package"
          value={providerPackage ? providerPackage.providerId : "Not delivered yet"}
        />
        <DataRow
          label="Coverage commitment"
          value={
            providerPackage?.coverageStatement ??
            "Delivery must declare the coverage scope."
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
              "Waiting for delivery"
            )
          }
        />
        <DataRow
          label="Deliverable type"
          value="Evidence Service Package; no full source text."
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
                  label="Coverage commitment"
                  value={providerPackage.coverageStatement}
                />
                <DataRow
                  label="Item verification status"
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
                  label="Item package hash"
                  value={
                    <span className="hash">{providerPackage.packageHash}</span>
                  }
                />
              </div>
            </article>
          ))
        ) : (
          <div className="info-strip">
            Run the Provider after escrow funding to generate source locators, summaries, relevance, coverage commitment, and hash fields.
          </div>
        )}
      </div>
    </Section>
  );
}
