import React, { useState } from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, sepoliaTxUrl, shortHash } from "../../lib/links";
import { formatCountdown, useCountdown } from "../../lib/useCountdown";
import { StepShell } from "../StepShell";

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
  const [score, setScore] = useState(5);
  const feedbackRecord = task.txRecords.find((r) => r.label === "feedback");
  const rated =
    Boolean(feedbackRecord) ||
    task.audit.some((e) => e.type === "reputation_feedback_published");
  const feedbackLink =
    feedbackRecord && isFullTxHash(feedbackRecord.txHash)
      ? sepoliaTxUrl(feedbackRecord.txHash)
      : null;

  const facts = [
    "核验通过：摘录、来源定位与覆盖声明一致",
    "挑战窗口内无人发起挑战",
    "按预算结算，无超支"
  ];

  return (
    <div className="rating-section" style={{ marginTop: 28 }} data-testid="rating-panel">
      <p className="section-kicker" style={{ margin: "0 0 12px" }}>
        服务评分
      </p>
      <div className="data-grid">
        <div className="data-row">
          <span className="data-label">本单回顾</span>
          <div className="data-value">
            {facts.map((fact) => (
              <div key={fact} className="dot-inline-wrap" style={{ marginBottom: 2 }}>
                <span className="dot ok" aria-hidden="true" />
                <span className="small">{fact}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="data-row" style={{ marginTop: 6 }}>
          <span className="data-label">总体评分</span>
          <div className="data-value">
            {rated ? (
              <span className="dot-inline-wrap">
                <span className="dot ok" aria-hidden="true" />
                <span className="small">
                  已评分，已记入专家链上信誉
                  {feedbackLink ? (
                    <>
                      {" "}·{" "}
                      <a className="hash" href={feedbackLink} target="_blank" rel="noreferrer">
                        查看信誉反馈交易
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
                  aria-label="选择评分（1-5 分）"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`rating-star${n <= score ? " active" : ""}`}
                      role="radio"
                      aria-checked={n === score}
                      aria-label={`${n} 分`}
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
                  {isBusy ? "评分上链中…" : "提交评分"}
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
      {!rated ? (
        <p className="small muted tight" style={{ marginTop: 8 }}>
          评分作为信誉反馈写入链上注册表，累积成下一位委托人看到的信誉分——它和挑战记录一样，专家自己改不了。
        </p>
      ) : null}
    </div>
  );
}

// Chinese labels for each tx record label.
const TX_LABEL_ZH: Record<string, string> = {
  approve: "授权代币",
  createJob: "创建委托订单",
  setBudget: "设定预算",
  fund: "注入托管资金",
  submit: "提交简报",
  complete: "结算放款",
  feedback: "信誉反馈",
};

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
function buildFinalAnswer(task: Task | null): {
  conclusion: string;
  evidenceSummary: string;
  cannotConclude: string;
} {
  const pkg = task?.providerPackage;
  if (!pkg || !pkg.answers.length) {
    return {
      conclusion: "研究简报为空，无法得出结论。",
      evidenceSummary: "无来源条目。",
      cannotConclude: "无法在缺少来源支撑的情况下得出结论。",
    };
  }

  // Conclusion: use the first answer's providerAnswer as the synthesized result.
  const conclusion = pkg.answers[0].providerAnswer;

  // Evidence summary: count + list of sourceTitles.
  const count = pkg.answers.length;
  const titles = pkg.answers
    .slice(0, 3)
    .map((a) => a.sourceTitle)
    .join("、");
  const evidenceSummary =
    count === 1
      ? `共 1 条来源支撑：${titles}`
      : `共 ${count} 条来源支撑，包括：${titles}${count > 3 ? " 等" : ""}。`;

  // Cannot conclude: synthesize from relevanceExplanation caveats.
  // Look for any answer that has a qualification or caveat phrasing.
  const caveat = pkg.answers
    .map((a) => a.relevanceExplanation)
    .find((r) => /不能|无法|局限|但|however|cannot|does not/i.test(r));
  const cannotConclude =
    caveat ||
    "简报不能证明全局完整性、普遍加速，或每种工作负载都能从并行执行中受益。";

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
  const status = task?.status;
  const isVerified = status === "Verified";
  const isSettled = status === "Settled" || status === "Audited";

  // Challenge window W_c: settlement stays locked (matching the on-chain
  // escrow gate) until the window after evidence submission has passed.
  const windowRemaining = useCountdown(task?.challengeWindowEndsAt);
  const windowOpen = isVerified && windowRemaining > 0;

  const verdictHash = findVerdictHash(task);
  const { conclusion, evidenceSummary, cannotConclude } = buildFinalAnswer(task);

  const txRecords = task?.txRecords ?? [];

  // Actions live in the StepShell row only — nothing duplicated in the body.
  // Verified: primary = 确认结算. Settled: primary = 开始新任务, secondary = 查看完整审计.
  let primary:
    | { label: string; onClick: () => void; disabled?: boolean; busy?: boolean }
    | undefined;

  if (isVerified) {
    primary = {
      label: windowOpen
        ? `挑战窗口剩余 ${formatCountdown(windowRemaining)} 后可结算`
        : "确认结算",
      onClick: onSettle,
      disabled: isBusy || windowOpen,
      busy: isBusy,
    };
  } else if (isSettled) {
    primary = {
      label: "开始新任务",
      onClick: onReset,
      disabled: isBusy,
    };
  }

  return (
    <StepShell
      stepNo={6}
      title="完成"
      subtitle="付款已在链上结算，整条委托链路可复盘。"
      primary={primary}
      secondary={
        isSettled
          ? {
              label: "查看完整审计",
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
              {" "}简报已通过核验。挑战窗口剩余{" "}
              <span className="mono">{formatCountdown(windowRemaining)}</span>
              ，窗口内仍可回到第 5 步发起挑战；窗口结束前合约拒绝放款。
            </>
          ) : (
            <>
              <span className="dot ok" aria-hidden="true" />
              {" "}简报已通过核验，挑战窗口已结束。点击「确认结算」在链上完成付款。
            </>
          )}
        </div>
      )}

      {/* ── 最终回答 ─────────────────────────────────── */}
      {isSettled && (
        <>
          <div className="final-answer-section">
            <p className="section-kicker" style={{ margin: "0 0 10px" }}>
              最终回答
            </p>

            <div className="data-row" style={{ marginBottom: 10 }}>
              <span className="data-label">主要发现</span>
              <div className="data-value">
                <p className="tight">{conclusion}</p>
              </div>
            </div>

            <div className="data-row" style={{ marginBottom: 10 }}>
              <span className="data-label">来源摘要</span>
              <div className="data-value">{evidenceSummary}</div>
            </div>

            <div className="data-row" style={{ marginBottom: 10 }}>
              <span className="data-label">不能得出的结论</span>
              <div className="data-value muted">{cannotConclude}</div>
            </div>
          </div>

          {/* ── 服务评分 ─────────────────────────────────── */}
          {task && <RatingPanel task={task} onRate={onRate} isBusy={isBusy} />}

          {/* ── 凭证清单 ─────────────────────────────────── */}
          <div className="receipt-section" style={{ marginTop: 28 }}>
            <p className="section-kicker" style={{ margin: "0 0 12px" }}>
              凭证清单
            </p>

            <dl className="receipt-list">
              {/* Task / job ID */}
              {task?.jobId !== null && task?.jobId !== undefined && (
                <div className="receipt-row">
                  <dt>Job ID</dt>
                  <dd>
                    <span className="mono">{task.jobId}</span>
                  </dd>
                </div>
              )}

              {/* Pact ID */}
              {task?.pact?.pactId && (
                <div className="receipt-row">
                  <dt>Pact ID</dt>
                  <dd>
                    <span className="mono">{task.pact.pactId}</span>
                  </dd>
                </div>
              )}

              {/* Package hash */}
              {task?.providerPackage?.packageHash && (
                <div className="receipt-row">
                  <dt>简报哈希</dt>
                  <dd>
                    <span className="mono">{task.providerPackage.packageHash}</span>
                  </dd>
                </div>
              )}

              {/* Verdict hash */}
              {verdictHash && (
                <div className="receipt-row">
                  <dt>Verdict 哈希</dt>
                  <dd>
                    <span className="mono">{verdictHash}</span>
                  </dd>
                </div>
              )}

              {/* All tx records */}
              {txRecords.map((record, index) => {
                const label = TX_LABEL_ZH[record.label] ?? record.label;
                const hasLink = isFullTxHash(record.txHash);
                return (
                  <div className="receipt-row" key={`${record.label}-${index}`}>
                    <dt>交易：{label}</dt>
                    <dd>
                      {hasLink ? (
                        <a
                          className="hash"
                          href={sepoliaTxUrl(record.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`在 Etherscan 查看「${label}」交易`}
                        >
                          {shortHash(record.txHash)}
                        </a>
                      ) : record.txHash ? (
                        <span className="mono">{record.txHash}</span>
                      ) : (
                        <span className="muted small">未确认</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </>
      )}
    </StepShell>
  );
}
