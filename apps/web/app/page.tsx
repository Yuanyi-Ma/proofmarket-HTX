"use client";

import React from "react";
import { getProviderProfiles } from "@proofmarket/shared/src/fixtures";
import { libraryInfo, type LibraryId } from "@proofmarket/shared/src/libraries";
import { displayAsset } from "../lib/assets";
import { injectiveAddressUrl, shortAddress } from "../lib/links";
import { useI18n } from "../components/I18nProvider";
import { LanguageToggle } from "../components/LanguageToggle";

type DisplayProvider = {
  name: string;
  specialty: string;
  libraries: LibraryId[];
  price: string;
  score: number;
  challenged: number;
  upheld: number;
  address: string;
};

const stats = ["36", "1,283", "1,847", "47 / 9", "2.6 min", "9"] as const;

export default function LandingPage() {
  const { locale, t } = useI18n();
  const protocolProviders: DisplayProvider[] = getProviderProfiles(locale).map((p) => ({
    name: p.name,
    specialty: p.coverage,
    libraries: p.libraries,
    price: displayAsset(p.price),
    score: p.reputationScore,
    challenged: p.challengeStats.challenged,
    upheld: p.challengeStats.upheld,
    address: p.address
  }));
  const displayProviders: DisplayProvider[] = [
    ...protocolProviders,
    {
      name: t.landing.displayProviders[0].name,
      specialty: t.landing.displayProviders[0].specialty,
      libraries: ["gartner", "idc", "statista", "cb-insights", "messari-pro"],
      price: "1.2 USDC",
      score: 941,
      challenged: 2,
      upheld: 0,
      address: "0x7Fa9385bE102ac3EAc297483Dd6233D62b3e1496"
    },
    {
      name: t.landing.displayProviders[1].name,
      specialty: t.landing.displayProviders[1].specialty,
      libraries: ["bloomberg", "wind", "spcapitaliq"],
      price: "0.9 USDC",
      score: 907,
      challenged: 1,
      upheld: 0,
      address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30"
    }
  ];

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-shell lp-nav-inner">
          <a className="brand" href="/">ProofMarket</a>
          <nav className="lp-nav-links" aria-label={t.nav.site}>
            <a href="#providers">{t.nav.providers}</a>
            <a href="#how">{t.nav.how}</a>
            <a href="/system">{t.nav.system}</a>
          </nav>
          <div className="lp-nav-actions">
            <LanguageToggle />
            <a className="lp-nav-cta" href="/console">{t.nav.console}</a>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-shell lp-hero">
          <div className="lp-hero-copy">
            <h1 className="lp-h1">ProofMarket</h1>
            <p className="lp-sub">{t.landing.subtitle}</p>
            <div className="lp-cta-row">
              <a className="lp-btn-primary" href="/console">{t.landing.primary}</a>
              <a className="lp-btn-secondary" href="/system">{t.landing.secondary}</a>
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>
              {t.landing.process}
            </p>
          </div>

          <aside className="lp-param-card" aria-label={t.landing.paramsKicker}>
            <p className="section-kicker" style={{ margin: "0 0 4px" }}>{t.landing.paramsKicker}</p>
            <div className="data-grid">
              <div className="data-row">
                <span className="data-label">{t.landing.bond}</span>
                <div className="data-value mono">10 USDC</div>
              </div>
              <div className="data-row">
                <span className="data-label">{t.landing.challengeDeposit}</span>
                <div className="data-value mono">2 / 0.5 USDC</div>
              </div>
              <div className="data-row">
                <span className="data-label">{t.landing.defaultSlash}</span>
                <div className="data-value mono">{t.landing.defaultSlashValue}</div>
              </div>
              <div className="data-row">
                <span className="data-label">{t.landing.windows}</span>
                <div className="data-value mono">{t.landing.windowValue}</div>
              </div>
              <div className="data-row">
                <span className="data-label">{t.landing.juryPool}</span>
                <div className="data-value mono">{t.landing.juryPoolValue}</div>
              </div>
            </div>
          </aside>
        </section>

        <section className="lp-stats-band" aria-label={t.landing.statsAria}>
          <div className="lp-shell lp-stats">
            {stats.map((value, index) => (
              <div className="lp-stat" key={t.landing.stats[index]}>
                <span className="lp-stat-value mono">{value}</span>
                <span className="lp-stat-label">{t.landing.stats[index]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-shell lp-section" id="providers" aria-label={t.landing.providersTitle}>
          <h2 className="lp-section-title">{t.landing.providersTitle}</h2>
          <p className="lp-section-sub">{t.landing.providersSub}</p>
          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th>{t.landing.providerColumn}</th>
                  <th>{t.landing.evidenceAbility}</th>
                  <th className="lp-num">{t.landing.price}</th>
                  <th className="lp-num">{t.landing.reputation}</th>
                  <th className="lp-num">{t.landing.challengeRecord}</th>
                  <th>{t.landing.onchainIdentity}</th>
                  <th>{t.landing.status}</th>
                </tr>
              </thead>
              <tbody>
                {displayProviders.map((p) => (
                  <tr key={p.address}>
                    <td className="lp-td-name">{p.name}</td>
                    <td className="lp-td-specialty">
                      {p.specialty}
                      <span className="lib-tag-row">
                        {p.libraries.map((lib) => (
                          <span className="lib-tag" key={lib}>
                            {libraryInfo(lib, locale).name}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="lp-num mono">{p.price}</td>
                    <td className="lp-num mono">{p.score} / 1000</td>
                    <td className="lp-num mono">
                      {p.challenged === 0 ? t.landing.noChallenges : t.landing.challengesUpheld(p.challenged, p.upheld)}
                    </td>
                    <td>
                      <a className="hash" href={injectiveAddressUrl(p.address)} target="_blank" rel="noreferrer">
                        {shortAddress(p.address)}
                      </a>
                    </td>
                    <td>
                      <span className="dot-inline-wrap">
                        <span className="dot ok" aria-hidden="true" />
                        <span className="small">{t.common.online}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="lp-shell lp-section" id="how" aria-label={t.landing.howTitle}>
          <h2 className="lp-section-title">{t.landing.howTitle}</h2>
          <p className="lp-section-sub">{t.landing.howSub}</p>
          <div className="lp-steps">
            {t.landing.steps.map((step, index) => (
              <div className="lp-step" key={step.title}>
                <span className="lp-step-no mono">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-step-body">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="lp-cta-row" style={{ marginTop: 32 }}>
            <a className="lp-btn-primary" href="/console">{t.landing.primary}</a>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-shell lp-footer-inner">
          <span>© 2026 ProofMarket · {t.landing.footerBuilt}</span>
          <nav className="lp-nav-links" aria-label={t.nav.footer}>
            <a href="/console">{t.nav.console}</a>
            <a href="/system">{t.nav.system}</a>
            <a href="#">{t.nav.docs}</a>
            <a href="#">{t.nav.github}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
