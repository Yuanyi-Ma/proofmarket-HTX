import React, { useState } from "react";
import { getProviderProfiles } from "@proofmarket/shared/src/fixtures";
import { libraryInfo } from "@proofmarket/shared/src/libraries";
import type { PlanCandidate, ProviderId, Task } from "@proofmarket/shared/src/types";
import { DataRow } from "../Section";
import { StatusBadge } from "../StatusBadge";
import { StepShell } from "../StepShell";
import { displayAsset } from "../../lib/assets";
import { injectiveAddressUrl, shortAddress } from "../../lib/links";
import { useI18n } from "../I18nProvider";

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
  const { locale, t } = useI18n();
  const providerProfiles = getProviderProfiles(locale);
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

  /** Find a provider's on-chain reputation score (real mode only). */
  function onChainScore(providerId: ProviderId): number | null {
    if (!plan?.providerReputations) return null;
    const entry = plan.providerReputations.find((r) => r.providerId === providerId);
    return entry?.source === "erc8004" ? entry.score : null;
  }

  return (
    <StepShell
      stepNo={2}
      title={t.step2.title}
      subtitle={t.step2.subtitle}
      primary={
        readOnly || !plan
          ? undefined
          : {
              label: t.step2.primary,
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
              <StatusBadge tone="success">{t.step2.decision}</StatusBadge>
            </div>
            <DataRow
              label={t.step2.expected}
              value={t.step2.expectedValue}
            />
            <DataRow
              label={t.step2.why}
              value={
                <div className="decision-reasons">
                  <span>
                    {t.step2.coverageMatch}{" "}
                    {recommendedProfile?.coverage ?? plan.evidenceNeed}
                  </span>
                  <span>
                    {t.step2.performance} {t.step2.reputationScore}{" "}
                    <span className="mono">
                      {recommendedProfile?.reputationScore ?? "—"} / 1000
                    </span>
                    {recommendedProfile?.challengeStats.challenged === 0
                      ? `, ${t.step2.noUpheld}`
                      : `, ${t.step2.challenged(
                          recommendedProfile?.challengeStats.challenged ?? 0,
                          recommendedProfile?.challengeStats.upheld ?? 0
                        )}`}
                  </span>
                  <span>
                    {t.step2.priceInLimit} {t.step2.expectedPay}{" "}
                    <span className="mono">{displayAsset(plan.perJobCap)}</span>
                    {task?.budgetLimit ? (
                      <>
                        , {t.step2.userCap} <span className="mono">{displayAsset(task.budgetLimit)}</span>.
                      </>
                    ) : null}
                  </span>
                </div>
              }
            />
            <details className="technical-disclosure">
              <summary>{t.step2.viewRaw}</summary>
              <p className="small muted tight">{plan.evidenceNeed}</p>
            </details>
          </article>

          <p className="small muted tight" style={{ marginTop: 16 }}>
            {t.step2.candidates(candidates.length)}
          </p>
          <p className="small muted tight" style={{ marginTop: 4 }}>
            {t.step2.candidateHint}
          </p>

          <div className="candidate-list" role="radiogroup" aria-label={t.step2.title}>
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
                      {isTop ? <StatusBadge tone="success">{t.common.recommended}</StatusBadge> : null}
                    </div>

                    <p className="candidate-reason">{compactReason(candidate.reason)}</p>

                    <div className="candidate-facts">
                      <span className="candidate-fact">
                        <span className="data-label">{t.step2.price}</span>
                        <span className="mono">{displayAsset(profile.price)}</span>
                      </span>
                      <span className="candidate-fact">
                        <span className="data-label">{t.step2.reputation}</span>
                        <span className="mono">
                          {chainScore !== null ? (
                            <>
                              {chainScore} / 1000{" "}
                              <span className="chain-rep-tag">{t.step2.reputation}</span>
                            </>
                          ) : (
                            <>{profile.reputationScore} / 1000</>
                          )}
                        </span>
                      </span>
                      <span className="candidate-fact">
                        <span className="data-label">{t.step2.challengeRecord}</span>
                        <span className="mono">
                          {profile.challengeStats.challenged === 0
                            ? t.step2.noChallengeRecord
                            : t.step2.challenged(
                                profile.challengeStats.challenged,
                                profile.challengeStats.upheld
                              )}
                        </span>
                      </span>
                      <span className="candidate-fact">
                        <span className="data-label">{t.step2.onchainIdentity}</span>
                        <span className="mono">
                          <a
                            className="hash"
                            href={injectiveAddressUrl(profile.address)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t.step2.viewAddress(profile.name)}
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

                    <div className="lib-tag-row" aria-label={t.step2.evidenceSources}>
                      {profile.libraries.map((lib) => (
                        <span className="lib-tag" key={lib}>
                          {libraryInfo(lib, locale).name}
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
              {t.step2.changedProvider}
            </div>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <p className="section-kicker" style={{ margin: "0 0 8px" }}>{t.step2.terms}</p>
            <div className="data-grid">
              <DataRow
                label={t.step2.deliverable}
                value={t.step2.deliverableValue}
              />
              <DataRow
                label={t.step2.acceptance}
                value={t.step2.acceptanceValue}
              />
              <DataRow
                label={t.step2.budget}
                value={
                  <span className="mono">
                    {t.step2.expectedPay} {displayAsset(plan.perJobCap)}
                    {task?.budgetLimit
                      ? ` · ${t.step2.userCap} ${displayAsset(task.budgetLimit)}`
                      : ` · ${t.step2.planBudget} ${displayAsset(plan.totalBudget)}`}
                  </span>
                }
              />
              <DataRow
                label={t.step2.settlement}
                value={t.step2.settlementValue}
              />
              <DataRow
                label={t.step2.protection}
                value={t.step2.protectionValue}
              />
            </div>
          </div>

          {readOnly ? (
            <div className="info-strip">{t.step2.readonly}</div>
          ) : null}
        </>
      ) : (
        <div className="info-strip">{t.step2.empty}</div>
      )}
    </StepShell>
  );
}
