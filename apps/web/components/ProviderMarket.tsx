import React from "react";
import { providerProfiles } from "@proofmarket/shared/src/fixtures";
import type { ProviderProfile, Task } from "@proofmarket/shared/src/types";
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
    return "Top pick on priors: IEEE + Elsevier coverage with a curated corpus, highest on-chain reputation, no upheld challenges.";
  }

  if (provider.role === "risky") {
    return "Lower-probability pick: similar claimed sources but no curated corpus, lower reputation and prior upheld coverage challenges.";
  }

  return "IEEE-only and self-reportedly partial on execution acceleration — useful as a supplement, not a full match.";
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

  /** 查找某个 provider 在链上信誉列表里的得分（仅 real mode 有）。 */
  function onChainScore(providerId: ProviderProfile["id"]): number | null {
    const reps = task?.plan?.providerReputations;
    if (!reps) return null;
    const entry = reps.find((r) => r.providerId === providerId);
    return entry?.source === "erc8004" ? entry.score : null;
  }

  return (
    <Section title="Provider market" kicker="Registered agents">
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
                      ? "Risky"
                      : "Comparison"}
                </StatusBadge>
                <StatusBadge>Agent ID {provider.agentId}</StatusBadge>
              </div>
              <h3>{provider.name}</h3>
            </div>

            <div className="data-row">
              <span className="data-label">Coverage</span>
              <div className="data-value small">{provider.coverage}</div>
            </div>
            <div className="two-col">
              <div className="data-row">
                <span className="data-label">Price</span>
                <div className="data-value">{provider.price}</div>
              </div>
              <div className="data-row">
                <span className="data-label">Stake</span>
                <div className="data-value">{provider.stake}</div>
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
                          <span className="chain-rep-tag">链上信誉</span>
                        </>
                      );
                    }
                    return provider.reputationScore;
                  })()}
                </div>
              </div>
              <div className="data-row">
                <span className="data-label">History</span>
                <div className="data-value small">{`被挑战 ${provider.challengeStats.challenged} 次 / 成立 ${provider.challengeStats.upheld} 次`}</div>
              </div>
            </div>
            <div className="info-strip small">{recommendationCopy(provider)}</div>

            {provider.id === "execution-research-expert" ? (
              <button onClick={onRunExpert} disabled={!canRunProvider}>
                Run expert provider
              </button>
            ) : null}
            {provider.id === "shallow-search-provider" ? (
              <button
                className="secondary"
                onClick={onRunShallow}
                disabled={!canRunProvider}
              >
                Run shallow provider
              </button>
            ) : null}
            {provider.id === "general-web-summary" ? (
              <p className="small muted tight">
                No execution button in this demo path.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}
