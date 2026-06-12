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
  if (lower.includes("escrow")) return "委托托管合约";
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
    createJob: "创建专家订单",
    fund: "锁定托管资金",
    submit: "提交简报",
    complete: "结算放款",
    reject: "拒绝订单",
    approve: "授权代币",
    openChallenge: "发起挑战",
    setBudget: "设定预算"
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

function summarizeDenial(rawOutput: string): { code: string; reason: string } {
  const codeMatch = rawOutput.match(/"code"\s*:\s*"([^"]+)"/);
  const reasonMatch = rawOutput.match(/"reason"\s*:\s*"([^"]+)"/);
  if (codeMatch || reasonMatch) {
    return {
      code: codeMatch?.[1] ?? "POLICY_DENIED",
      reason: reasonMatch?.[1] ?? "策略未匹配，Cobo 拒绝执行"
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
      subtitle="这是主流程里少数必须显性看边界的页面：确认 Agent 能花多少钱、能调用哪些动作、哪些请求会被拒绝。"
      primary={
        pact
          ? {
              label: "执行采购",
              onClick: onExecute,
              disabled: isBusy || !canExecute,
              busy: isBusy
            }
          : undefined
      }
      secondary={
        pact && canExecute
          ? {
              label: "测试越权防护",
              onClick: onTriggerDenial,
              disabled: isBusy
            }
          : undefined
      }
    >
      {pact ? (
        <>
          <div className="pact-decision-grid" aria-label="支付授权摘要">
            <div className="pact-decision-item">
              <span className="data-label">可以做</span>
              <strong>创建委托、注资托管、结算或发起挑战</strong>
            </div>
            <div className="pact-decision-item">
              <span className="data-label">不可以做</span>
              <strong>直接转账、调用白名单外合约、过期后继续操作</strong>
            </div>
            <div className="pact-decision-item">
              <span className="data-label">资金边界</span>
              <strong>
                <span className="mono">{pact.totalBudget}</span>
                <span className="muted small"> 授权上限</span>
              </strong>
            </div>
          </div>

          {/* Pact boundary definition — retained as an expandable audit detail */}
          <details className="technical-disclosure pact-boundary">
            <summary>查看完整 Cobo 策略参数</summary>
            <div className="data-grid">
              <DataRow
                label="授权编号"
                value={<span className="mono">{pact.pactId}</span>}
              />
              <DataRow
                label="有效期"
                value={`${pact.expiresInMinutes} 分钟内有效，到期自动失效`}
              />
              <DataRow
                label="总预算"
                value={
                  <span>
                    <span className="mono">{pact.totalBudget}</span>
                    <span className="muted small">
                      {" — "}实际放款金额另受托管合约按订单预算约束
                    </span>
                  </span>
                }
              />
              <DataRow
                label="允许调用的合约"
                value={
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
                }
              />
              <DataRow
                label="允许调用的函数"
                value={
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
                }
              />
              <DataRow
                label="拒绝规则"
                value={
                  <ul className="pact-list">
                    {pact.denyRules.map((rule) => (
                      <li key={rule}>{resolveDenyRule(rule)}</li>
                    ))}
                  </ul>
                }
              />
            </div>
            <p className="small muted tight" style={{ marginTop: 8 }}>
              以上边界由 Cobo 策略引擎在服务端强制执行：边界内的调用直接放行，边界外的请求一律拒绝。
            </p>
          </details>

          {/* Authorization status */}
          <div className="pact-status-area">
            {isActive && (
              <>
                <div className="pact-authorized">
                  <span className="dot ok" aria-hidden="true" />
                  <span>授权已生效</span>
                </div>
                {!wasDenied && (
                  <p className="small muted tight">
                    「测试越权防护」会真实发起一笔边界外的转账请求，验证策略引擎将其拒绝——不会有任何资金移动。
                  </p>
                )}
              </>
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

            {isBusy ? (
              <div className="info-strip">
                正在按授权边界执行采购：授权代币 → 创建订单 → 设定预算 → 锁定托管资金。测试网确认较慢时，稍后会进入第 4 步显示逐笔交易。
              </div>
            ) : null}

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
              {(() => {
                const summary = summarizeDenial(denial.rawOutput);
                return (
                  <>
                    <div className="data-row" style={{ marginTop: 10 }}>
                      <span className="data-label">拒绝码</span>
                      <div className="data-value">
                        <span className="mono">{summary.code}</span>
                      </div>
                    </div>
                    <div className="data-row" style={{ marginTop: 8 }}>
                      <span className="data-label">拒绝原因</span>
                      <div className="data-value">{summary.reason}</div>
                    </div>
                  </>
                );
              })()}
              <div className="data-row" style={{ marginTop: 10 }}>
                <span className="data-label">尝试的操作</span>
                <div className="data-value">
                  <span className="mono">{denial.attemptedAction}</span>
                </div>
              </div>
              <details className="technical-disclosure denial-raw-disclosure">
                <summary>查看 Cobo 原始返回</summary>
                <pre className="denial-output">{denial.rawOutput}</pre>
              </details>
              <div
                className="info-strip"
                style={{ marginTop: 10, background: "var(--ok-bg)", borderColor: "var(--ok)", color: "var(--ok)" }}
              >
                防护生效：该请求在策略引擎处被完整阻断，链上零资金流出。
              </div>
              <p className="small muted tight" style={{ marginTop: 10 }}>
                Pact 依然有效，可继续执行采购。
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
