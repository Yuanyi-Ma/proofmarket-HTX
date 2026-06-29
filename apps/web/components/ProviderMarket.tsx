import React from "react";
import { providerProfiles } from "@proofmarket/shared/src/fixtures";
import type { ProviderProfile, Task } from "@proofmarket/shared/src/types";
import { displayAsset } from "../lib/assets";
import { Section } from "./Section";
import { StatusBadge } from "./StatusBadge";

type ProviderMarketProps = {
  task: Task | null;
  onRunExpert: () => void;
  onRunShallow: () => void;
  isBusy?: boolean;
};

function recommendationCopy(provider: ProviderProfile): string {
  if (provider.role === "recommended") {
    return "Recommended: IEEE + Elsevier coverage matches the local curated corpus, with the highest on-chain reputation and no upheld challenges.";
  }

  if (provider.role === "risky") {
    return "Higher risk: similar claimed sources, but no curated domain corpus, lower reputation, and prior upheld challenges.";
  }

  return "Comparison option: IEEE-only coverage with partial execution-layer fit; useful as a benchmark, not the main Provider for this job.";
}

function roleTone(provider: ProviderProfile) {
  if (provider.role === "recommended") return "success" as const;
  if (provider.role === "risky") return "danger" as const;
  return "warning" as const;
}

export function ProviderMarket({
  task,
  onRunExpert,
  onRunShallow,
  isBusy = false
}: ProviderMarketProps) {
  const canRunProvider = !isBusy && task?.status === "JobFunded";

  /** Find a provider's on-chain reputation score (real mode only). */
  function onChainScore(providerId: ProviderProfile["id"]): number | null {
    const reps = task?.plan?.providerReputations;
    if (!reps) return null;
    const entry = reps.find((r) => r.providerId === providerId);
    return entry?.source === "erc8004" ? entry.score : null;
  }

  return (
    <Section title="Provider Market" kicker="Registered Agents">
      <div className="provider-grid">
        {providerProfiles.map((provider) => (
          <article
            className={`provider-card ${provider.role}`}
            data-provider-card={provider.id}
            key={provider.id}
          >
            <div>
              <div className="badge-row">
                <StatusBadge tone={roleTone(provider)}>
                  {provider.role === "recommended"
                    ? "Recommended"
                    : provider.role === "risky"
                      ? "High Risk"
                      : "Comparison"}
                </StatusBadge>
                <StatusBadge>Agent ID {provider.agentId}</StatusBadge>
              </div>
              <h3>{provider.name}</h3>
            </div>

            <div className="data-row">
              <span className="data-label">Evidence capability</span>
              <div className="data-value small">{provider.coverage}</div>
            </div>
            <div className="two-col">
              <div className="data-row">
                <span className="data-label">Price</span>
                <div className="data-value">{displayAsset(provider.price)}</div>
              </div>
              <div className="data-row">
                <span className="data-label">Performance bond</span>
                <div className="data-value">{displayAsset(provider.stake)}</div>
              </div>
            </div>
            <div className="two-col">
              <div className="data-row">
                <span className="data-label">Reputation</span>
                <div className="data-value">
                  {(() => {
                    const chainScore = onChainScore(provider.id);
                    if (chainScore !== null) {
                      return (
                        <>
                          {chainScore}{" "}
                          <span className="chain-rep-tag">On-chain</span>
                        </>
                      );
                    }
                    return provider.reputationScore;
                  })()}
                </div>
              </div>
              <div className="data-row">
                <span className="data-label">Challenge record</span>
                <div className="data-value small">{`${provider.challengeStats.challenged} challenged / ${provider.challengeStats.upheld} upheld`}</div>
              </div>
            </div>
            <div className="info-strip small">{recommendationCopy(provider)}</div>

            {provider.id === "execution-research-expert" ? (
              <button onClick={onRunExpert} disabled={!canRunProvider}>
                Run Recommended Provider
              </button>
            ) : null}
            {provider.id === "shallow-search-provider" ? (
              <button
                className="secondary"
                onClick={onRunShallow}
                disabled={!canRunProvider}
              >
                Run Low-Reputation Provider
              </button>
            ) : null}
            {provider.id === "general-web-summary" ? (
              <p className="small muted tight">
                This comparison Provider is not executed in the current path.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}
