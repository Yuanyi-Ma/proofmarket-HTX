import React, { useState } from "react";
import { providerProfiles } from "@proofmarket/shared/src/fixtures";
import { LIBRARIES } from "@proofmarket/shared/src/libraries";
import type { PlanCandidate, ProviderId, Task } from "@proofmarket/shared/src/types";
import { DataRow } from "../Section";
import { StatusBadge } from "../StatusBadge";
import { StepShell } from "../StepShell";
import { sepoliaAddressUrl, shortAddress } from "../../lib/links";

type Step2PlanProps = {
  task: Task | null;
  /** Confirm with the provider the user selected from the shortlist. */
  onConfirm: (providerId: ProviderId) => void;
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

  // Ranked shortlist the user picks from. Real mode + fixture both populate
  // plan.candidates; fall back to the catalog order if somehow absent.
  const candidates: PlanCandidate[] =
    plan?.candidates && plan.candidates.length > 0
      ? plan.candidates
      : providerProfiles.map((p, i) => ({
          providerId: p.id,
          rank: i + 1,
          reason: p.coverage
        }));

  const [selected, setSelected] = useState<ProviderId>(
    (plan?.recommendedProviderId as ProviderId) ?? candidates[0]?.providerId
  );
  const recommendedCandidate =
    candidates.find((c) => c.providerId === plan?.recommendedProviderId) ??
    candidates[0];
  const recommendedProfile = providerProfiles.find(
    (p) => p.id === recommendedCandidate?.providerId
  );

  function compactReason(reason: string): string {
    if (reason.length <= 120) return reason;
    return `${reason.slice(0, 118)}…`;
  }

  /** 查找某个 provider 在链上信誉列表里的得分（仅 real mode 有）。 */
  function onChainScore(providerId: ProviderId): number | null {
    if (!plan?.providerReputations) return null;
    const entry = plan.providerReputations.find((r) => r.providerId === providerId);
    return entry?.source === "erc8004" ? entry.score : null;
  }

  return (
    <StepShell
      stepNo={2}
      title="选择领域专家"
      subtitle="先做采购决策：买什么、找谁买、预计花多少。可信记录只作为选择专家时的证据。"
      primary={
        readOnly || !plan
          ? undefined
          : {
              label: "确认方案，去授权",
              onClick: () => onConfirm(selected),
              disabled: isBusy || !selected,
              busy: isBusy
            }
      }
    >
      {plan ? (
        <>
          <article className="recommend-card purchase-summary-card">
            <div className="badge-row">
              <StatusBadge tone="success">购买决策</StatusBadge>
            </div>
            <DataRow
              label="预计买到"
              value="一份研究简报：关键结论、来源定位、摘录摘要和不能得出的结论；不购买资料全文。"
            />
            <DataRow
              label="为什么推荐"
              value={
                <div className="decision-reasons">
                  <span>
                    资料库覆盖与问题匹配：
                    {recommendedProfile?.coverage ?? plan.evidenceNeed}
                  </span>
                  <span>
                    历史表现可比较：信誉分{" "}
                    <span className="mono">
                      {recommendedProfile?.reputationScore ?? "—"} / 1000
                    </span>
                    {recommendedProfile?.challengeStats.challenged === 0
                      ? "，暂无成立挑战。"
                      : `，被挑战 ${recommendedProfile?.challengeStats.challenged} 次 / 成立 ${recommendedProfile?.challengeStats.upheld} 次。`}
                  </span>
                  <span>
                    价格在授权上限内：本单预计支付{" "}
                    <span className="mono">{plan.perJobCap}</span>
                    {task?.budgetLimit ? (
                      <>
                        ，用户授权上限 <span className="mono">{task.budgetLimit}</span>。
                      </>
                    ) : null}
                  </span>
                </div>
              }
            />
            <details className="technical-disclosure">
              <summary>查看 Agent 原始分析</summary>
              <p className="small muted tight">{plan.evidenceNeed}</p>
            </details>
          </article>

          <p className="small muted tight" style={{ marginTop: 16 }}>
            候选专家（共 {candidates.length} 位，默认选中推荐项，可改选）
          </p>
          <p className="small muted tight" style={{ marginTop: 4 }}>
            这里先解决产品问题：谁最可能交付一份可用简报。链上信誉和挑战记录是购买信号，不是本页主角。
          </p>

          <div className="candidate-list" role="radiogroup" aria-label="选择专家">
            {candidates.map((candidate) => {
              const profile = providerProfiles.find((p) => p.id === candidate.providerId);
              if (!profile) return null;
              const isSelected = selected === candidate.providerId;
              const isTop = candidate.rank === 1;
              const chainScore = onChainScore(candidate.providerId);

              return (
                <label
                  key={candidate.providerId}
                  className={`candidate-card${isSelected ? " selected" : ""}`}
                  data-provider-row={candidate.providerId}
                >
                  <input
                    type="radio"
                    name="provider-choice"
                    className="candidate-radio"
                    value={candidate.providerId}
                    checked={isSelected}
                    disabled={readOnly || isBusy}
                    onChange={() => setSelected(candidate.providerId)}
                  />
                  <div className="candidate-body">
                    <div className="candidate-head">
                      <span className="candidate-rank">#{candidate.rank}</span>
                      <strong>{profile.name}</strong>
                      {isTop ? <StatusBadge tone="success">推荐</StatusBadge> : null}
                    </div>

                    <p className="candidate-reason">{compactReason(candidate.reason)}</p>

                    <div className="candidate-facts">
                      <span className="candidate-fact">
                        <span className="data-label">价格</span>
                        <span className="mono">{profile.price}</span>
                      </span>
                      <span className="candidate-fact">
                        <span className="data-label">信誉分</span>
                        <span className="mono">
                          {chainScore !== null ? (
                            <>
                              {chainScore} / 1000{" "}
                              <span className="chain-rep-tag">链上信誉</span>
                            </>
                          ) : (
                            <>{profile.reputationScore} / 1000</>
                          )}
                        </span>
                      </span>
                      <span className="candidate-fact">
                        <span className="data-label">挑战记录</span>
                        <span className="mono">
                          {profile.challengeStats.challenged === 0
                            ? "无挑战记录"
                            : `被挑战 ${profile.challengeStats.challenged} 次 / 成立 ${profile.challengeStats.upheld} 次`}
                        </span>
                      </span>
                      <span className="candidate-fact">
                        <span className="data-label">链上身份</span>
                        <span className="mono">
                          <a
                            className="hash"
                            href={sepoliaAddressUrl(profile.address)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`在 Etherscan 查看 ${profile.name} 的链上地址`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortAddress(profile.address)}
                          </a>
                          {" · "}
                          <span className="muted">Agent #{profile.agentId}</span>
                        </span>
                      </span>
                    </div>

                    <p className="small muted tight candidate-coverage">{profile.coverage}</p>

                    <div className="lib-tag-row" aria-label="资料库授权">
                      {profile.libraries.map((lib) => (
                        <span className="lib-tag" key={lib}>
                          {LIBRARIES[lib].name}
                        </span>
                      ))}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {!readOnly && selected !== plan.recommendedProviderId ? (
            <div className="info-strip" style={{ marginTop: 12 }}>
              你选择的不是 Agent 的推荐项。该专家在"自报资料覆盖 + 链上信誉"上属于较低概率的选择，交付完整性的先验风险更高——若简报有缺口，可在第 5 步发起挑战。
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <p className="section-kicker" style={{ margin: "0 0 8px" }}>购买条款</p>
            <div className="data-grid">
              <DataRow
                label="交付物"
                value="研究简报：结论 + 来源定位 + 限长摘录（研报类按订阅条款转述），并附针对你问题的总结；不搬运资料全文，原文不出授权边界。"
              />
              <DataRow
                label="验收方式"
                value="先看简报是否有用；来源、摘录和覆盖范围会在第 5 步抽查，发现问题再走挑战。"
              />
              <DataRow
                label="预算"
                value={
                  <span className="mono">
                    本单预计支付 {plan.perJobCap}
                    {task?.budgetLimit
                      ? ` · 授权上限 ${task.budgetLimit}`
                      : ` · 方案预算 ${plan.totalBudget}`}
                  </span>
                }
              />
              <DataRow
                label="结算条件"
                value="资金先入链上托管；简报通过核验后，买方可直接验收结算，也可在挑战窗口内发起挑战。"
              />
              <DataRow
                label="违约保障"
                value="交付与声明不符可发起挑战；挑战成立即全额退款，并从专家质押中扣罚赔付。"
              />
            </div>
          </div>

          {readOnly ? (
            <div className="info-strip">方案已确认，此处为只读回看。</div>
          ) : null}
        </>
      ) : (
        <div className="info-strip">
          购买方案尚未生成。请回到第 1 步提交研究问题。
        </div>
      )}
    </StepShell>
  );
}
