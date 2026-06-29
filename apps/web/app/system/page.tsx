import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cookies } from "next/headers";
import { createPublicClient, http } from "viem";
import { getViemChainByChainId } from "@proofmarket/chain/src/chains";
import { challengeManagerAbi, erc20Abi, escrowAbi } from "@proofmarket/chain/src/escrowAbi";
import {
  readReputationSummary,
  reputationSummaryToScore1000
} from "@proofmarket/chain/src/erc8004";
import { getProofMarketNetworkByChainId } from "@proofmarket/shared/src/chains";
import { parseDeploymentArtifact } from "@proofmarket/shared/src/realMode";
import { getProviderProfiles, presetJurors } from "@proofmarket/shared/src/fixtures";
import { libraryInfo, libraryNamesForLocale } from "@proofmarket/shared/src/libraries";
import { normalizeLocale } from "@proofmarket/shared/src/locale";
import { injectiveAddressUrl, shortAddress } from "../../lib/links";
import { getUiText, LOCALE_COOKIE } from "../../lib/i18n";

// Live chain reads on every request: this page is the on-screen proof of the
// Live proof of system readiness; it must never serve a cached state.
export const dynamic = "force-dynamic";

const usdc = (raw: bigint) => `${Number(raw) / 1e6} USDC`;

async function loadSystemState() {
  const providerProfiles = getProviderProfiles("en");
  const root = join(process.cwd(), "..", "..");
  const injectiveDeployment = join(root, "deployments", "injective.json");
  const deploymentPath =
    process.env.INJECTIVE_DEPLOYMENT_PATH ??
    (existsSync(injectiveDeployment)
      ? injectiveDeployment
      : join(root, "deployments", "sepolia.json"));
  const artifact = parseDeploymentArtifact(
    JSON.parse(readFileSync(deploymentPath, "utf8"))
  );
  const network = getProofMarketNetworkByChainId(artifact.chainId);
  const rpcUrl = process.env[network.rpcEnvVar] ?? network.defaultRpcUrl;
  const client = createPublicClient({
    chain: getViemChainByChainId(artifact.chainId),
    transport: http(rpcUrl)
  });

  const cm = artifact.contracts.ProofMarketChallengeManager as `0x${string}`;
  const escrow = artifact.contracts.ProofMarketEscrow as `0x${string}`;
  const token = artifact.contracts.MockUSDC as `0x${string}`;

  const readCm = <T,>(functionName: string, args: unknown[] = []) =>
    client.readContract({
      address: cm,
      abi: challengeManagerAbi,
      functionName,
      args
    } as never) as Promise<T>;

  const [minStake, deposit, juryFee, defenseWindow, jurySize, jurorCount, challengeWindow, signerBalance] =
    await Promise.all([
      readCm<bigint>("minStake" as never).catch(() => 10_000_000n),
      readCm<bigint>("challengeDeposit" as never).catch(() => 2_000_000n),
      readCm<bigint>("juryFee"),
      readCm<bigint>("defenseWindow"),
      readCm<bigint>("jurySize"),
      readCm<bigint>("jurorCount"),
      client.readContract({ address: escrow, abi: escrowAbi, functionName: "challengeWindow" }) as Promise<bigint>,
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [artifact.policySignerAddress as `0x${string}`]
      }) as Promise<bigint>
    ]);

  // Each juror's on-chain registration commitment (model/prompt hashes).
  const jurors = await Promise.all(
    (artifact.jurors ?? []).map(async (juror) => {
      const onChain = (await readCm<[string, string, boolean]>("jurors", [juror.address]).catch(
        () => null
      )) as [string, string, boolean] | null;
      return {
        ...juror,
        modelHash: onChain?.[0] ?? null,
        promptHash: onChain?.[1] ?? null,
        registered: onChain?.[2] ?? false
      };
    })
  );

  // The on-chain provider signer carries the stake for every job; catalog
  // providers carry the ERC-8004 identities and reputation.
  const expertAddress = artifact.providers?.["execution-research-expert"]?.address ?? "";
  const [stake, lockedStake] = await Promise.all([
    readCm<bigint>("stake", [expertAddress]),
    readCm<bigint>("lockedStake", [expertAddress])
  ]);

  const reputations = await Promise.all(
    providerProfiles.map(async (profile) => {
      if (!artifact.erc8004) return { id: profile.id, score: profile.reputationScore, source: "fixture" };
      const agentId = artifact.providers?.[profile.id]?.agentId ?? profile.agentId;
      try {
        const summary = await readReputationSummary(
          rpcUrl,
          artifact.erc8004.reputationRegistry as `0x${string}`,
          BigInt(agentId),
          "",
          "",
          undefined,
          artifact.chainId
        );
        if (summary.count === 0n) throw new Error("no feedback");
        return { id: profile.id, score: reputationSummaryToScore1000(summary), source: "erc8004" };
      } catch {
        return { id: profile.id, score: profile.reputationScore, source: "fixture" };
      }
    })
  );

  return {
    artifact,
    params: { minStake, deposit, juryFee, defenseWindow, jurySize, jurorCount, challengeWindow },
    jurors,
    expert: { address: expertAddress, stake, lockedStake, free: stake - lockedStake },
    signerBalance,
    reputations
  };
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="data-row" style={{ marginTop: 6 }}>
      <span className="data-label">
        <span className={`dot ${ok ? "ok" : "danger"}`} aria-hidden="true" />
      </span>
      <div className="data-value">{label}</div>
    </div>
  );
}

export default async function SystemPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getUiText(locale);
  const providerProfiles = getProviderProfiles(locale);
  const state = await loadSystemState();
  const { artifact, params, jurors, expert, signerBalance, reputations } = state;
  const slash = (params.minStake * 5000n) / 10000n;
  const reward = (slash * 5000n) / 10000n;
  const jurySeated = params.jurorCount === params.jurySize && jurors.every((j) => j.registered);
  const stakeOk = expert.free >= params.minStake;
  const signerOk = signerBalance >= params.deposit + params.juryFee;

  return (
    <main className="wizard-shell" style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ marginBottom: 4 }}>{t.system.title}</h1>
      <p className="muted small" style={{ marginTop: 0 }}>
        {t.system.subtitle}
      </p>

      <section className="recommend-card" style={{ marginTop: 20 }} aria-label={t.system.readiness}>
        <p className="section-kicker" style={{ margin: "0 0 8px" }}>{t.system.readiness}</p>
        <CheckRow ok label={t.system.checks.contracts} />
        <CheckRow
          ok={jurySeated}
          label={t.system.checks.jury(String(params.jurorCount), String(params.jurySize))}
        />
        <CheckRow
          ok={stakeOk}
          label={t.system.checks.stake(usdc(expert.free), usdc(params.minStake), usdc(expert.stake), usdc(expert.lockedStake))}
        />
        <CheckRow ok={signerOk} label={t.system.checks.signer(usdc(signerBalance))} />
      </section>

      <section style={{ marginTop: 24 }}>
        <p className="section-kicker">{t.system.contracts}</p>
        <div className="data-grid">
          <div className="data-row">
            <span className="data-label">{t.system.escrow}</span>
            <div className="data-value mono">
              <a className="hash" href={injectiveAddressUrl(artifact.contracts.ProofMarketEscrow)} target="_blank" rel="noreferrer">
                {shortAddress(artifact.contracts.ProofMarketEscrow)}
              </a>
              <span className="muted"> · challenge window = {String(params.challengeWindow)}s</span>
            </div>
          </div>
          <div className="data-row">
            <span className="data-label">{t.system.challengeManager}</span>
            <div className="data-value mono">
              <a className="hash" href={injectiveAddressUrl(artifact.contracts.ProofMarketChallengeManager ?? "")} target="_blank" rel="noreferrer">
                {shortAddress(artifact.contracts.ProofMarketChallengeManager ?? "")}
              </a>
              <span className="muted">
                {" "}· D={usdc(params.deposit)} · F={usdc(params.juryFee)} · S={usdc(slash)} · R={usdc(reward)} · R_w={String(params.defenseWindow)}s · N={String(params.jurySize)}
              </span>
            </div>
          </div>
          <div className="data-row">
            <span className="data-label">{t.system.token}</span>
            <div className="data-value mono">
              <a className="hash" href={injectiveAddressUrl(artifact.contracts.MockUSDC)} target="_blank" rel="noreferrer">
                {shortAddress(artifact.contracts.MockUSDC)}
              </a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 24 }} aria-label={t.system.juryPool(String(params.jurorCount), String(params.jurySize))}>
        <p className="section-kicker">{t.system.juryPool(String(params.jurorCount), String(params.jurySize))}</p>
        <div className="evidence-items-list">
          {jurors.map((juror) => (
            <details key={juror.jurorId} className="evidence-item-row" open>
              <summary className="evidence-item-summary">
                <span className="evidence-item-title">
                  {t.system.juror(jurors.indexOf(juror))}
                </span>
                <span className={`status-badge ${juror.registered ? "success" : "danger"}`}>
                  {juror.registered ? t.system.registered : t.system.unregistered}
                </span>
              </summary>
              <div className="evidence-item-body">
                <div className="data-row">
                  <span className="data-label">{t.system.address}</span>
                  <div className="data-value mono">
                    <a className="hash" href={injectiveAddressUrl(juror.address)} target="_blank" rel="noreferrer">
                      {juror.address}
                    </a>
                  </div>
                </div>
                <div className="data-row">
                  <span className="data-label">{t.system.modelCommitment}</span>
                  <div className="data-value mono">
                    {juror.modelHash ? `${juror.modelHash.slice(0, 26)}…` : "—"}
                  </div>
                </div>
                <div className="data-row">
                  <span className="data-label">{t.system.procedureCommitment}</span>
                  <div className="data-value mono">
                    {juror.promptHash ? `${juror.promptHash.slice(0, 26)}…` : "—"}
                  </div>
                </div>
                <div className="data-row">
                  <span className="data-label">{t.system.verificationCapability}</span>
                  <div className="data-value">
                    {libraryNamesForLocale(
                      presetJurors[jurors.indexOf(juror)]?.libraryAccess ?? [],
                      locale
                    ) || "—"}
                    <span className="muted small">
                      {" "}· {t.system.capabilityNote}
                    </span>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
        <p className="small muted tight" style={{ marginTop: 8 }}>
          {t.system.juryNote}
        </p>
      </section>

      <section style={{ marginTop: 24 }} aria-label="Provider">
        <p className="section-kicker">{t.system.providers}</p>
        <div className="data-grid">
          {providerProfiles.map((profile) => {
            const rep = reputations.find((r) => r.id === profile.id);
            const provider = artifact.providers?.[profile.id];
            const address = provider?.address ?? profile.address;
            const agentId = provider?.agentId ?? profile.agentId;
            return (
              <div className="data-row" key={profile.id}>
                <span className="data-label">{profile.name}</span>
                <div className="data-value">
                  <span className="mono">
                    <a className="hash" href={injectiveAddressUrl(address)} target="_blank" rel="noreferrer">
                      {shortAddress(address)}
                    </a>
                    {" "}· Agent #{agentId}
                  </span>
                  <span className="muted small">
                    {" "}· {t.system.reputation} {rep?.score}/1000{rep?.source === "erc8004" ? ` (${t.system.onchain})` : ""} · {t.system.challenged(profile.challengeStats.challenged, profile.challengeStats.upheld)}
                  </span>
                  <span className="lib-tag-row">
                    {profile.libraries.map((lib) => (
                      <span className="lib-tag" key={lib}>
                        {libraryInfo(lib, locale).name}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
          <div className="data-row">
            <span className="data-label">{t.system.executionAddress}</span>
            <div className="data-value">
              <span className="mono">
                <a className="hash" href={injectiveAddressUrl(expert.address)} target="_blank" rel="noreferrer">
                  {shortAddress(expert.address)}
                </a>
              </span>
              <span className="muted small">
                {" "}· {t.system.executionAddressNote(usdc(expert.stake), usdc(params.minStake))}
              </span>
            </div>
          </div>
        </div>
      </section>

      <p className="small muted" style={{ marginTop: 28 }}>
        <a href="/">← {t.system.backHome}</a>
        {" · "}
        <a href="/console">{t.system.openConsole}</a>
      </p>
    </main>
  );
}
