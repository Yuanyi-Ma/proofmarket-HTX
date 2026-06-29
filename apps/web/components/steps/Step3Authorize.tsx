import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import type { Locale } from "@proofmarket/shared/src/locale";
import { displayAllowedTarget, displayAsset } from "../../lib/assets";
import { DataRow } from "../Section";
import { StepShell } from "../StepShell";
import { useI18n } from "../I18nProvider";

type Step3AuthorizeProps = {
  task: Task | null;
  onExecute: () => void;
  onCheckApproval: () => void;
  onTriggerDenial: () => void;
  isBusy?: boolean;
};

// Resolve a contract address/name to a readable label.
function resolveTargetLabel(target: string, locale: Locale): string {
  const lower = target.toLowerCase();
  if (lower.includes("escrow")) return locale === "zh" ? "委托托管合约" : "Escrow contract";
  if (lower.includes("usdc") || lower.includes("token") || lower.includes("mockusdc")) {
    return locale === "zh" ? "代币合约（USDC）" : "Token contract (USDC)";
  }
  if (lower.includes("challenge")) return locale === "zh" ? "挑战管理合约" : "Challenge manager contract";
  // If it looks like a hex address, keep it mono but truncated.
  if (/^0x[0-9a-fA-F]{40}$/.test(target)) {
    return `${target.slice(0, 10)}…${target.slice(-6)}`;
  }
  return target;
}

// Resolve raw function names to readable descriptions.
function resolveFunctionLabel(fn: string, locale: Locale): string {
  const map: Record<string, { en: string; zh: string }> = {
    createJob: { en: "Create Provider job", zh: "创建 Provider 订单" },
    fund: { en: "Fund escrow", zh: "锁定托管资金" },
    submit: { en: "Submit package", zh: "提交证据包" },
    complete: { en: "Settle payment", zh: "结算放款" },
    reject: { en: "Reject job", zh: "拒绝订单" },
    approve: { en: "Approve token", zh: "授权代币" },
    openChallenge: { en: "Open challenge", zh: "发起挑战" },
    setBudget: { en: "Set budget", zh: "设定预算" }
  };
  return map[fn]?.[locale] ?? fn;
}

// Resolve raw deny rules to plain labels.
function resolveDenyRule(rule: string, locale: Locale): string {
  const map: Record<string, { en: string; zh: string }> = {
    "direct transfer": { en: "Deny direct transfers", zh: "禁止直接转账" },
    "non-whitelisted target": { en: "Deny calls to non-allowlisted contracts", zh: "禁止调用白名单外的合约" },
    "amount above cap": { en: "Deny amounts above the per-call cap", zh: "禁止超出单笔上限的金额" },
    "expired policy": { en: "Deny operations after policy expiry", zh: "策略过期后禁止操作" }
  };
  return map[rule]?.[locale] ?? rule;
}

function summarizeDenial(rawOutput: string, locale: Locale): { code: string; reason: string } {
  const codeMatch = rawOutput.match(/"code"\s*:\s*"([^"]+)"/);
  const reasonMatch = rawOutput.match(/"reason"\s*:\s*"([^"]+)"/);
  if (codeMatch || reasonMatch) {
    return {
      code: codeMatch?.[1] ?? "POLICY_DENIED",
      reason: reasonMatch?.[1] ?? (locale === "zh"
        ? "策略未匹配，策略签名器拒绝执行"
        : "No policy rule matched; the Policy Signer refused execution")
    };
  }

  const [head, ...rest] = rawOutput.split(":");
  return {
    code: head?.trim() || "POLICY_DENIED",
    reason: rest.join(":").trim() || rawOutput
  };
}

export function Step3Authorize({
  task,
  onExecute,
  onCheckApproval,
  onTriggerDenial,
  isBusy = false
}: Step3AuthorizeProps) {
  const { locale, t } = useI18n();
  const policy = task?.policy ?? null;
  const isActive = policy?.status === "active";
  const isSubmitted = policy?.status === "submitted";
  const denial = task?.denial ?? null;
  const wasDenied = task?.status === "DeniedByPolicy";

  // Primary: execute only when policy is active (or DeniedByPolicy — policy still active).
  const canExecute = isActive || wasDenied;

  return (
    <StepShell
      stepNo={3}
      title={t.step3.title}
      subtitle={t.step3.subtitle}
      primary={
        policy
          ? {
              label: t.step3.primary,
              onClick: onExecute,
              disabled: isBusy || !canExecute,
              busy: isBusy
            }
          : undefined
      }
      secondary={
        policy && canExecute
          ? {
              label: t.step3.secondary,
              onClick: onTriggerDenial,
              disabled: isBusy
            }
          : undefined
      }
    >
      {policy ? (
        <>
          <div className="policy-decision-grid" aria-label={t.step3.summaryAria}>
            <div className="policy-decision-item">
              <span className="data-label">{t.step3.allowed}</span>
              <strong>{t.step3.allowedValue}</strong>
            </div>
            <div className="policy-decision-item">
              <span className="data-label">{t.step3.denied}</span>
              <strong>{t.step3.deniedValue}</strong>
            </div>
            <div className="policy-decision-item">
              <span className="data-label">{t.step3.budget}</span>
              <strong>
                <span className="mono">{displayAsset(policy.totalBudget)}</span>
                <span className="muted small"> {t.step3.cap}</span>
              </strong>
            </div>
          </div>

          {/* Policy boundary definition — retained as an expandable audit detail */}
          <details className="technical-disclosure policy-boundary">
            <summary>{t.step3.details}</summary>
            <div className="data-grid">
              <DataRow
                label={t.step3.policyId}
                value={<span className="mono">{policy.policyId}</span>}
              />
              <DataRow
                label={t.step3.expiry}
                value={t.step3.expiryValue(policy.expiresInMinutes)}
              />
              <DataRow
                label={t.step3.totalBudget}
                value={
                  <span>
                    <span className="mono">{displayAsset(policy.totalBudget)}</span>
                    <span className="muted small">
                      {" - "}{t.step3.totalBudgetNote}
                    </span>
                  </span>
                }
              />
              <DataRow
                label={t.step3.targets}
                value={
                  <ul className="policy-list">
                    {policy.allowedTargets.map((target) => (
                      <li key={target}>
                        <span className="mono">{displayAllowedTarget(target)}</span>
                        <span className="muted small">
                          {" - "}
                          {resolveTargetLabel(target, locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                }
              />
              <DataRow
                label={t.step3.functions}
                value={
                  <ul className="policy-list">
                    {policy.allowedFunctions.map((fn) => (
                      <li key={fn}>
                        <span className="mono">{fn}</span>
                        <span className="muted small">
                          {" - "}
                          {resolveFunctionLabel(fn, locale)}
                        </span>
                      </li>
                    ))}
                  </ul>
                }
              />
              <DataRow
                label={t.step3.denyRules}
                value={
                  <ul className="policy-list">
                    {policy.denyRules.map((rule) => (
                      <li key={rule}>{resolveDenyRule(rule, locale)}</li>
                    ))}
                  </ul>
                }
              />
            </div>
            <p className="small muted tight" style={{ marginTop: 8 }}>
              {t.step3.boundaryNote}
            </p>
          </details>

          {/* Authorization status */}
          <div className="policy-status-area">
            {isActive && (
              <>
                <div className="policy-authorized">
                  <span className="dot ok" aria-hidden="true" />
                  <span>{t.step3.active}</span>
                </div>
                {!wasDenied && (
                  <p className="small muted tight">
                    {t.step3.guardrailHint}
                  </p>
                )}
              </>
            )}

            {isSubmitted && (
              <div className="info-strip policy-awaiting">
                <div>{t.step3.submitted}</div>
                <button
                  type="button"
                  className="secondary"
                  onClick={onCheckApproval}
                  disabled={isBusy}
                  style={{ marginTop: 10, display: "inline-flex" }}
                >
                  {t.step3.checkStatus}
                </button>
              </div>
            )}

            {isBusy ? (
              <div className="info-strip">
                {t.step3.executing}
              </div>
            ) : null}

            {!isActive && !isSubmitted && !wasDenied && (
              <div className="info-strip">
                {t.step3.unknown(policy.status)}
              </div>
            )}
          </div>

          {/* Denial result card — rendered when DeniedByPolicy, non-blocking */}
          {wasDenied && denial && (
            <div className="denial-card" role="alert" aria-label={t.step3.denialAria}>
              <div className="denial-card-header">
                <span className="dot danger" aria-hidden="true" />
                <strong>{t.step3.denialTitle}</strong>
              </div>
              {(() => {
                const summary = summarizeDenial(denial.rawOutput, locale);
                return (
                  <>
                    <div className="data-row" style={{ marginTop: 10 }}>
                      <span className="data-label">{t.step3.rejectCode}</span>
                      <div className="data-value">
                        <span className="mono">{summary.code}</span>
                      </div>
                    </div>
                    <div className="data-row" style={{ marginTop: 8 }}>
                      <span className="data-label">{t.step3.rejectReason}</span>
                      <div className="data-value">{summary.reason}</div>
                    </div>
                  </>
                );
              })()}
              <div className="data-row" style={{ marginTop: 10 }}>
                <span className="data-label">{t.step3.attempted}</span>
                <div className="data-value">
                  <span className="mono">{denial.attemptedAction}</span>
                </div>
              </div>
              <details className="technical-disclosure denial-raw-disclosure">
                <summary>{t.step3.rawReturn}</summary>
                <pre className="denial-output">{denial.rawOutput}</pre>
              </details>
              <div
                className="info-strip"
                style={{ marginTop: 10, background: "var(--ok-bg)", borderColor: "var(--ok)", color: "var(--ok)" }}
              >
                {t.step3.guardrailOk}
              </div>
              <p className="small muted tight" style={{ marginTop: 10 }}>
                {t.step3.stillActive}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="info-strip">{t.step3.missing}</div>
      )}
    </StepShell>
  );
}
