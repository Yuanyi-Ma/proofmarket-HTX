import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { DataRow } from "../Section";
import { StepShell } from "../StepShell";

type Step3AuthorizeProps = {
  task: Task | null;
  onExecute: () => void;
  onCheckApproval: () => void;
  onTriggerDenial: () => void;
  isBusy?: boolean;
};

// Resolve a contract address/name to a readable Chinese label.
function resolveTargetLabel(target: string): string {
  const lower = target.toLowerCase();
  if (lower.includes("escrow")) return "采购托管合约";
  if (lower.includes("usdc") || lower.includes("token") || lower.includes("mockusdc")) return "代币合约（USDC）";
  if (lower.includes("challenge")) return "挑战仲裁合约";
  // If it looks like a hex address, keep it mono but truncated.
  if (/^0x[0-9a-fA-F]{40}$/.test(target)) {
    return `${target.slice(0, 10)}…${target.slice(-6)}`;
  }
  return target;
}

// Resolve raw function names to Chinese descriptions.
function resolveFunctionLabel(fn: string): string {
  const map: Record<string, string> = {
    createJob: "创建订单",
    fund: "注入托管资金",
    submit: "提交证据",
    complete: "结算放款",
    reject: "拒绝订单",
    approve: "授权代币"
  };
  return map[fn] ?? fn;
}

// Resolve raw deny rules to plain Chinese.
function resolveDenyRule(rule: string): string {
  const map: Record<string, string> = {
    "direct transfer": "禁止直接转账",
    "non-whitelisted target": "禁止调用白名单外的合约",
    "amount above cap": "禁止超出单笔上限的金额",
    "expired pact": "Pact 过期后禁止操作"
  };
  return map[rule] ?? rule;
}

export function Step3Authorize({
  task,
  onExecute,
  onCheckApproval,
  onTriggerDenial,
  isBusy = false
}: Step3AuthorizeProps) {
  const pact = task?.pact ?? null;
  const isActive = pact?.status === "active";
  const isSubmitted = pact?.status === "submitted";
  const denial = task?.denial ?? null;
  const wasDenied = task?.status === "DeniedByCobo";

  // Primary: execute only when pact is active (or DeniedByCobo — pact still active).
  const canExecute = isActive || wasDenied;

  return (
    <StepShell
      stepNo={3}
      title="授权支付边界"
      subtitle="钱由 Cobo 智能钱包按策略放行，Agent 不能越权花钱。下面是本次授权的边界。"
      primary={
        pact
          ? {
              label: "执行链上采购",
              onClick: onExecute,
              disabled: isBusy || !canExecute,
              busy: isBusy
            }
          : undefined
      }
      secondary={
        pact && canExecute
          ? {
              label: "演示越权拦截",
              onClick: onTriggerDenial,
              disabled: isBusy
            }
          : undefined
      }
    >
      {pact ? (
        <>
          {/* Pact boundary definition */}
          <div className="pact-boundary">
            <p className="section-kicker" style={{ margin: "0 0 10px" }}>
              Pact 边界
            </p>
            <div className="data-grid">
              <DataRow
                label="Pact ID"
                value={<span className="mono">{pact.pactId}</span>}
              />
              <DataRow
                label="过期时间"
                value={`${pact.expiresInMinutes} 分钟内有效`}
              />
              <DataRow
                label="总预算上限"
                value={<span className="mono">{pact.totalBudget}</span>}
              />
              <DataRow
                label="单笔上限"
                value={
                  <span className="mono">
                    ≤ {pact.perJobCap}
                  </span>
                }
              />
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="data-row">
                <span className="data-label">允许调用的合约</span>
                <div className="data-value">
                  <ul className="pact-list">
                    {pact.allowedTargets.map((target) => (
                      <li key={target}>
                        <span className="mono">{target}</span>
                        <span className="muted small">
                          {" — "}
                          {resolveTargetLabel(target)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div className="data-row">
                <span className="data-label">允许调用的函数</span>
                <div className="data-value">
                  <ul className="pact-list">
                    {pact.allowedFunctions.map((fn) => (
                      <li key={fn}>
                        <span className="mono">{fn}</span>
                        <span className="muted small">
                          {" — "}
                          {resolveFunctionLabel(fn)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div className="data-row">
                <span className="data-label">拒绝规则</span>
                <div className="data-value">
                  <ul className="pact-list">
                    {pact.denyRules.map((rule) => (
                      <li key={rule} className="muted small">
                        {resolveDenyRule(rule)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Authorization status */}
          <div className="pact-status-area">
            {isActive && (
              <div className="pact-authorized">
                <span className="dot ok" aria-hidden="true" />
                <span>已授权（演示钱包自动批准）</span>
              </div>
            )}

            {isSubmitted && (
              <div className="info-strip pact-awaiting">
                <div>请在 Cobo App 中批准此授权，批准后点击检查按钮刷新状态。</div>
                <button
                  type="button"
                  className="secondary"
                  onClick={onCheckApproval}
                  disabled={isBusy}
                  style={{ marginTop: 10, display: "inline-flex" }}
                >
                  检查批准状态
                </button>
              </div>
            )}

            {!isActive && !isSubmitted && !wasDenied && (
              <div className="info-strip">
                Pact 尚未提交或状态不明。当前状态：{pact.status}
              </div>
            )}
          </div>

          {/* Denial result card — rendered when DeniedByCobo, non-blocking */}
          {wasDenied && denial && (
            <div className="denial-card" role="alert" aria-label="越权拦截记录">
              <div className="denial-card-header">
                <span className="dot danger" aria-hidden="true" />
                <strong>越权操作已被 Cobo 拦截</strong>
              </div>
              <div className="data-row" style={{ marginTop: 10 }}>
                <span className="data-label">尝试的操作</span>
                <div className="data-value">
                  <span className="mono">{denial.attemptedAction}</span>
                </div>
              </div>
              <div className="data-row" style={{ marginTop: 8 }}>
                <span className="data-label">Cobo 返回（原文）</span>
                <div className="data-value">
                  <pre className="denial-output">{denial.rawOutput}</pre>
                </div>
              </div>
              <div
                className="info-strip"
                style={{ marginTop: 10, background: "var(--ok-bg)", borderColor: "var(--ok)", color: "var(--ok)" }}
              >
                链上零资金流出——此次操作被 Cobo 策略引擎完全阻断，没有任何资金移动。
              </div>
              <p className="small muted tight" style={{ marginTop: 10 }}>
                Pact 依然有效，可继续执行链上采购。
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="info-strip">
          Pact 尚未生成。请先在第 2 步确认采购方案并提交授权。
        </div>
      )}
    </StepShell>
  );
}
