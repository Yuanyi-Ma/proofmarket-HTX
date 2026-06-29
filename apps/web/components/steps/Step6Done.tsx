import React, { useState } from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, injectiveTxUrl, shortHash } from "../../lib/links";
import { formatCountdown, useCountdown } from "../../lib/useCountdown";
import { StepShell } from "../StepShell";
import { useI18n } from "../I18nProvider";

type Step6DoneProps = {
  task: Task | null;
  onSettle: () => void;
  onRate: (score: number) => void;
  onReset: () => void;
  onOpenAudit: () => void;
  isBusy?: boolean;
};

// User rating panel — the act of rating is what publishes the on-chain
// reputation feedback (rate endpoint), so the score is a real protocol event,
// not decorative stars. Facts above the picker are derived from task state.
function RatingPanel({
  task,
  onRate,
  isBusy
}: {
  task: Task;
  onRate: (score: number) => void;
  isBusy: boolean;
}) {
  const { t } = useI18n();
  const [score, setScore] = useState(5);
  const feedbackRecord = task.txRecords.find((r) => r.label === "feedback");
  const rated =
    Boolean(feedbackRecord) ||
    task.audit.some((e) => e.type === "reputation_feedback_published");
  const feedbackLink =
    feedbackRecord && isFullTxHash(feedbackRecord.txHash)
      ? injectiveTxUrl(feedbackRecord.txHash)
      : null;

  const facts = t.step6.facts;

  return (
    <div className="rating-section" style={{ marginTop: 28 }} data-testid="rating-panel">
      <p className="section-kicker" style={{ margin: "0 0 12px" }}>
        {t.step6.rating}
      </p>
      <div className="data-grid">
        <div className="data-row">
          <span className="data-label">{t.step6.review}</span>
          <div className="data-value rating-facts">
            {facts.map((fact) => (
              <div key={fact} className="dot-inline-wrap" style={{ marginBottom: 2 }}>
                <span className="dot ok" aria-hidden="true" />
                <span className="small">{fact}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="data-row" style={{ marginTop: 6 }}>
          <span className="data-label">{t.step6.overall}</span>
          <div className="data-value">
            {rated ? (
              <span className="dot-inline-wrap">
                <span className="dot ok" aria-hidden="true" />
                <span className="small">
                  {t.step6.rated}
                  {feedbackLink ? (
                    <>
                      {" "}·{" "}
                      <a className="hash" href={feedbackLink} target="_blank" rel="noreferrer">
                        {t.step6.viewFeedback}
                      </a>
                    </>
                  ) : null}
                </span>
              </span>
            ) : (
              <span className="rating-row">
                <span
                  className="rating-stars"
                  role="radiogroup"
                  aria-label={t.step6.ratingAria}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rating-star${n <= score ? " active" : ""}`}
                      role="radio"
                      aria-checked={n === score}
                      aria-label={t.step6.points(n)}
                      disabled={isBusy}
                      onClick={() => setScore(n)}
                    >
                      ★
                    </button>
                  ))}
                </span>
                <span className="mono small" style={{ margin: "0 10px 0 6px" }}>
                  {score} / 5
                </span>
                <button
                  type="button"
                  onClick={() => onRate(score)}
                  disabled={isBusy}
                  aria-busy={isBusy ? "true" : undefined}
                >
                  {isBusy ? t.step6.ratingBusy : t.step6.submitRating}
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
      {!rated ? (
        <p className="small muted tight" style={{ marginTop: 8 }}>
          {t.step6.ratingNote}
        </p>
      ) : null}
    </div>
  );
}

// Try to extract a verdict hash from the audit trail.
function extractVerdictHash(message: string): string | null {
  const explicit = message.match(/verdictHash=([0-9a-fA-Fx]+)/);
  if (explicit?.[1]) return explicit[1];
  const embedded = message.match(/0x[0-9a-fA-F]{64}/);
  if (embedded?.[0]) return embedded[0];
  return null;
}

function findVerdictHash(task: Task | null): string | null {
  if (!task) return null;
  for (const event of task.audit) {
    if (
      event.type === "verification_passed" ||
      event.type === "settlement" ||
      event.type === "verified"
    ) {
      const h = extractVerdictHash(event.message);
      if (h) return h;
    }
  }
  for (const event of task.audit) {
    if (event.type.includes("verif") || event.type.includes("verdict")) {
      if (isFullTxHash(event.txHash)) return event.txHash;
      const h = extractVerdictHash(event.message);
      if (h) return h;
    }
  }
  return null;
}

// Build the final answer from providerPackage data.
function buildFinalAnswer(task: Task | null, t: ReturnType<typeof useI18n>["t"]): {
  conclusion: string;
  evidenceSummary: string;
  cannotConclude: string;
} {
  const pkg = task?.providerPackage;
  if (!pkg || !pkg.answers.length) {
    return {
      conclusion: t.step6.emptyConclusion,
      evidenceSummary: t.step6.emptyEvidence,
      cannotConclude: t.step6.emptyCannot,
    };
  }

  // Conclusion: use the first answer's providerAnswer as the synthesized result.
  const conclusion = pkg.answers[0].providerAnswer;

  // Evidence summary: count + list of sourceTitles.
  const count = pkg.answers.length;
  const titles = pkg.answers
    .slice(0, 3)
    .map((a) => a.sourceTitle)
    .join(", ");
  const evidenceSummary =
    count === 1
      ? t.step6.sourceSummaryOne(titles)
      : t.step6.sourceSummaryMany(count, titles);

  // Cannot conclude: synthesize from relevanceExplanation caveats.
  // Look for any answer that has a qualification or caveat phrasing.
  const caveat = pkg.answers
    .map((a) => a.relevanceExplanation)
    .find((r) => /不能|无法|局限|但|however|cannot|does not/i.test(r));
  const cannotConclude =
    caveat ||
    t.step6.defaultCannot;

  return { conclusion, evidenceSummary, cannotConclude };
}

export function Step6Done({
  task,
  onSettle,
  onRate,
  onReset,
  onOpenAudit,
  isBusy = false,
}: Step6DoneProps) {
  const { t } = useI18n();
  const status = task?.status;
  const isVerified = status === "Verified";
  const isSettled = status === "Settled" || status === "Audited";

  // Challenge window W_c stays visible as a challenge period, but the client
  // can accept the work immediately. That complete() transaction is the
  // protocol-level "no challenge" signal.
  const windowRemaining = useCountdown(task?.challengeWindowEndsAt);
  const windowOpen = isVerified && windowRemaining > 0;

  const verdictHash = findVerdictHash(task);
  const { conclusion, evidenceSummary, cannotConclude } = buildFinalAnswer(task, t);

  const txRecords = task?.txRecords ?? [];
  const subtitle = isVerified
    ? t.step6.verifiedSubtitle
    : t.step6.settledSubtitle;

  // Actions live in the StepShell row only — nothing duplicated in the body.
  // Verified: primary = confirm settlement. Settled: primary = new task, secondary = full audit.
  let primary:
    | { label: string; onClick: () => void; disabled?: boolean; busy?: boolean }
    | undefined;

  if (isVerified) {
    primary = {
      label: windowOpen ? t.step6.settleNow : t.step6.confirmSettle,
      onClick: onSettle,
      disabled: isBusy,
      busy: isBusy,
    };
  } else if (isSettled) {
    primary = {
      label: t.step6.newTask,
      onClick: onReset,
      disabled: isBusy,
    };
  }

  return (
    <StepShell
      stepNo={6}
      title={t.step6.title}
      subtitle={subtitle}
      primary={primary}
      secondary={
        isSettled
          ? {
              label: t.step6.audit,
              onClick: onOpenAudit,
            }
          : undefined
      }
    >
      {/* ── 结算待确认提示 (Verified, not yet settled) ── */}
      {isVerified && (
        <div className="info-strip" style={{ marginBottom: 20 }} data-testid="settle-window-note">
          {windowOpen ? (
            <>
              <span className="dot pending" aria-hidden="true" />
              {" "}{t.step6.windowOpen(formatCountdown(windowRemaining))}
            </>
          ) : (
            <>
              <span className="dot ok" aria-hidden="true" />
              {" "}{t.step6.windowClosed}
            </>
          )}
        </div>
      )}

      {/* ── 最终回答 ─────────────────────────────────── */}
      {isSettled && (
        <>
          <div className="final-answer-section">
            <p className="section-kicker" style={{ margin: "0 0 10px" }}>
              {t.step6.finalAnswer}
            </p>

            <div className="data-row" style={{ marginBottom: 10 }}>
              <span className="data-label">{t.step6.mainFinding}</span>
              <div className="data-value">
                <p className="tight">{conclusion}</p>
              </div>
            </div>

            <div className="data-row" style={{ marginBottom: 10 }}>
              <span className="data-label">{t.step6.sourceSummary}</span>
              <div className="data-value">{evidenceSummary}</div>
            </div>

            <div className="data-row" style={{ marginBottom: 10 }}>
              <span className="data-label">{t.step6.cannotConclude}</span>
              <div className="data-value muted">{cannotConclude}</div>
            </div>
          </div>

          {/* ── 服务评分 ─────────────────────────────────── */}
          {task && <RatingPanel task={task} onRate={onRate} isBusy={isBusy} />}

          {/* ── 交易与凭证 ─────────────────────────────────── */}
          <details className="receipt-section technical-disclosure" style={{ marginTop: 28 }}>
            <summary>{t.step6.receipts}</summary>

            <dl className="receipt-list">
              {/* Task / job ID */}
              {task?.jobId !== null && task?.jobId !== undefined && (
                <div className="receipt-row">
                  <dt>{t.step6.jobId}</dt>
                  <dd>
                    <span className="mono">{task.jobId}</span>
                  </dd>
                </div>
              )}

              {/* Policy ID */}
              {task?.policy?.policyId && (
                <div className="receipt-row">
                  <dt>{t.step6.policyId}</dt>
                  <dd>
                    <span className="mono">{task.policy.policyId}</span>
                  </dd>
                </div>
              )}

              {/* Package hash */}
              {task?.providerPackage?.packageHash && (
                <div className="receipt-row">
                  <dt>{t.step6.packageHash}</dt>
                  <dd>
                    <span className="mono">{task.providerPackage.packageHash}</span>
                  </dd>
                </div>
              )}

              {/* Verdict hash */}
              {verdictHash && (
                <div className="receipt-row">
                  <dt>{t.step6.verdictHash}</dt>
                  <dd>
                    <span className="mono">{verdictHash}</span>
                  </dd>
                </div>
              )}

              {/* All tx records */}
              {txRecords.map((record, index) => {
                const label = t.step4.txLabels[record.label] ?? record.label;
                const hasLink = isFullTxHash(record.txHash);
                return (
                  <div className="receipt-row" key={`${record.label}-${index}`}>
                    <dt>{t.step6.tx(label)}</dt>
                    <dd>
                      {hasLink ? (
                        <a
                          className="hash"
                          href={injectiveTxUrl(record.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${t.common.viewOnInjective}: ${label}`}
                        >
                          {shortHash(record.txHash)}
                        </a>
                      ) : record.txHash ? (
                        <span className="mono">{record.txHash}</span>
                      ) : (
                        <span className="muted small">{t.common.unconfirmed}</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </details>
        </>
      )}
    </StepShell>
  );
}
