import React from "react";
import { providerProfiles } from "@proofmarket/shared/src/fixtures";
import type { Task } from "@proofmarket/shared/src/types";
import { DataRow } from "../Section";
import { StatusBadge } from "../StatusBadge";
import { StepShell } from "../StepShell";

type Step2PlanProps = {
  task: Task | null;
  onConfirm: () => void;
  isBusy?: boolean;
  /** True when reviewing this step after it is done: no action button. */
  readOnly?: boolean;
};

export function Step2Plan({
  task,
  onConfirm,
  isBusy = false,
  readOnly = false
}: Step2PlanProps) {
  const plan = task?.plan ?? null;
  const recommended = plan
    ? providerProfiles.find((p) => p.id === plan.recommendedProviderId) ?? null
    : null;

  return (
    <StepShell
      stepNo={2}
      title="采购方案"
      subtitle="Research Agent（真实 Claude Code）已分析你的问题并推荐了证据来源。确认后进入授权。"
      primary={
        readOnly || !plan
          ? undefined
          : {
              label: "确认方案，去授权",
              onClick: onConfirm,
              disabled: isBusy,
              busy: isBusy
            }
      }
    >
      {plan ? (
        <>
          <article className="recommend-card">
            <div className="badge-row">
              <StatusBadge tone="success">Agent 推荐</StatusBadge>
            </div>
            <h3>{recommended?.name ?? plan.recommendedProviderId}</h3>
            <div className="data-grid">
              <DataRow label="推荐理由" value={plan.evidenceNeed} />
              <DataRow label="验证方式" value={plan.verificationMethod} />
              <DataRow
                label="预计花费"
                value={
                  <span className="mono">
                    总预算 {plan.totalBudget} · 单笔上限 {plan.perJobCap}
                  </span>
                }
              />
              <DataRow label="覆盖范围" value={plan.coverage} />
            </div>
          </article>

          <div>
            <p className="small muted tight">Provider 对比（共 {plan.providerCount} 个候选）</p>
            <div className="provider-table-wrap">
              <table className="provider-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>覆盖范围</th>
                    <th>价格</th>
                    <th>信誉分</th>
                  </tr>
                </thead>
                <tbody>
                  {providerProfiles.map((provider) => {
                    const isRecommended =
                      provider.id === plan.recommendedProviderId;
                    return (
                      <tr
                        className={isRecommended ? "recommended" : undefined}
                        data-provider-row={provider.id}
                        key={provider.id}
                      >
                        <td>
                          {provider.name}
                          {isRecommended ? (
                            <>
                              {" "}
                              <StatusBadge tone="success">推荐</StatusBadge>
                            </>
                          ) : null}
                        </td>
                        <td className="muted">{provider.coverage}</td>
                        <td className="mono">{provider.price}</td>
                        <td className="mono">
                          {provider.reputationScore ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="data-grid">
            <DataRow
              label="预算明细"
              value={
                <span className="mono">
                  总预算 {plan.totalBudget} · 单个 Provider 上限 {plan.perJobCap}
                </span>
              }
            />
            <DataRow label="返回内容" value="带证据定位与核验线索的回答包，而非整篇文档或无限制的钱包访问。" />
          </div>

          {readOnly ? (
            <div className="info-strip">方案已确认，此处为只读回看。</div>
          ) : null}
        </>
      ) : (
        <div className="info-strip">
          采购方案尚未生成。请回到第 1 步提交研究问题。
        </div>
      )}
    </StepShell>
  );
}
