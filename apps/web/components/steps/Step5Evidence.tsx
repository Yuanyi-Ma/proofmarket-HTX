import React from "react";
import type { JuryVote, Task, TaskChallenge } from "@proofmarket/shared/src/types";
import type { TxRecord } from "@proofmarket/shared/src/realMode";
import {
  getPresetChallengeDocument,
  getPresetCounterEvidence
} from "@proofmarket/shared/src/fixtures";
import { libraryInfo, type LibraryId } from "@proofmarket/shared/src/libraries";
import {
  buildPackageCommitment,
  getMerkleProof,
  verifyMerkleProof
} from "@proofmarket/shared/src/merkle";
import { isFullTxHash, injectiveTxUrl, shortHash } from "../../lib/links";
import { LOCAL_CORPUS } from "../../lib/localCorpus";
import { formatCountdown, useCountdown } from "../../lib/useCountdown";
import { StepShell } from "../StepShell";
import { useI18n } from "../I18nProvider";

// 我方 Agent 概率性抽查的查全样本：来自用户侧本地资料库的「该方向应出现
// 文献」清单。命中与否按证据服务包实际内容（sourceLocator）比对——Provider 包命中、
// 速查包漏检是真实的内容差异，不是写死的结果。
const COMPLETENESS_SAMPLES = [
  {
    title:
      "Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing",
    locator: "doi:10.1145/3572848.3577524",
    library: "acm-dl" as LibraryId,
    kind: "paper" as const
  },
  {
    title: "State Hotspots in High-Throughput Smart-Contract Execution",
    locator: "delphi:state-hotspots-2025",
    library: "delphi-digital" as LibraryId,
    kind: "report" as const
  }
] as const;

// 查全样本必须先做范围匹配：只有落在该 Provider 承诺范围内的样本才计入
// 漏检。范围按声明的资料类型判断——声明含「研报」才把研报类样本计入，
// 论文类样本要求声明含「论文」。范围外的样本展示为灰色、不计入挑战。
function sampleInScope(
  pkg: NonNullable<Task["providerPackage"]>,
  sample: (typeof COMPLETENESS_SAMPLES)[number]
): boolean {
  const statement = pkg.coverageStatement.toLowerCase();
  return sample.kind === "report"
    ? statement.includes("report") || statement.includes("research subscription") || pkg.coverageStatement.includes("研报")
    : statement.includes("paper") || statement.includes("literature") || pkg.coverageStatement.includes("论文");
}

function packageMissesSample(pkg: NonNullable<Task["providerPackage"]>): boolean {
  return COMPLETENESS_SAMPLES.some(
    (sample) =>
      sampleInScope(pkg, sample) &&
      !pkg.answers.some((a) => a.sourceLocator === sample.locator)
  );
}

// 查准抽检的内容比对（本地存档子串匹配）。本地没有该来源 = 跳过（不算
// 失败）；本地存有但摘录对不上 = 比对失败（挑战材料之一）。
function excerptMismatches(pkg: NonNullable<Task["providerPackage"]>): boolean {
  return pkg.answers.some((a) => {
    const corpusText = LOCAL_CORPUS[a.sourceLocator];
    return corpusText != null && !corpusText.includes(a.excerptOrSummary);
  });
}

// 抽查总判定：查全漏检或查准比对失败，任一即触发"生成挑战包"。
function packageFailsSpotCheck(pkg: NonNullable<Task["providerPackage"]>): boolean {
  return packageMissesSample(pkg) || excerptMismatches(pkg);
}

// 我方 Agent 的抽查核验：查准（抽样比对摘录与本地库原文，并验证该叶子
// 确在 Provider 签名的承诺根下）+ 查全（抽样「理应出现」的文献看是否在证据服务包
// 内）。这是挑战机制成立的根基——产出难、概率性验证容易，所以可以先
// 信任交付，事后抽查兜底。
function AgentSpotCheck({ pkg }: { pkg: NonNullable<Task["providerPackage"]> }) {
  const { locale, t } = useI18n();
  // 查准抽样是两项真实计算的叠加，不是展示文案：
  // ① 内容比对——摘录必须逐字出现在本地资料库（LOCAL_CORPUS）对应来源的
  //    原文段落里；本地没有该来源 = 跳过（灰），存有但对不上 = 失败（红）；
  // ② 承诺绑定——该条目的叶子哈希沿 Merkle 路径折算回 Provider 签名上链的承诺
  //    根（底层校验不在 UI 单列，失败时并入红色状态文案）。
  const commitment = buildPackageCommitment(pkg);
  const accuracySamples = pkg.answers.slice(0, 4).map((answer) => {
    const leafIndex = pkg.answers.indexOf(answer) + 1; // 叶 0 为总述
    const proof = getMerkleProof(commitment.leafHashes, leafIndex);
    const corpusText = LOCAL_CORPUS[answer.sourceLocator];
    const proofOk = verifyMerkleProof(
      commitment.leafHashes[leafIndex],
      proof,
      pkg.packageHash
    );
    const state: "match" | "mismatch" | "skipped" =
      corpusText == null
        ? "skipped"
        : corpusText.includes(answer.excerptOrSummary) && proofOk
          ? "match"
          : "mismatch";
    return { answer, state };
  });
  const completeness = COMPLETENESS_SAMPLES.map((sample) => ({
    ...sample,
    inScope: sampleInScope(pkg, sample),
    present: pkg.answers.some((a) => a.sourceLocator === sample.locator)
  }));
  const missed = completeness.filter((c) => c.inScope && !c.present);
  const mismatched = accuracySamples.filter((s) => s.state === "mismatch");

  return (
    <div className="spot-check" style={{ marginTop: 20 }} data-testid="agent-spot-check">
      <p className="section-kicker" style={{ margin: "0 0 8px" }}>
        {t.step5.spotCheckTitle}
      </p>
      <div className="data-grid">
        <div className="data-row">
          <span className="data-label">{t.step5.accuracy}</span>
          <div className="data-value">
            {accuracySamples.map(({ answer, state }) => (
              <div key={answer.sourceLocator} className="dot-inline-wrap" style={{ marginBottom: 2 }}>
                <span
                  className={`dot ${state === "match" ? "ok" : state === "mismatch" ? "danger" : "neutral"}`}
                  aria-hidden="true"
                />
                <span className={`small${state === "skipped" ? " muted" : ""}`}>
                  {answer.sourceTitle}:{" "}
                  {state === "match"
                    ? t.step5.match
                    : state === "mismatch"
                      ? t.step5.mismatch
                      : t.step5.skipped}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.completeness}</span>
          <div className="data-value">
            {completeness.map((c) => (
              <div key={c.locator} className="dot-inline-wrap" style={{ marginBottom: 2 }}>
                <span
                  className={`dot ${c.present ? "ok" : c.inScope ? "danger" : "neutral"}`}
                  aria-hidden="true"
                />
                <span className={`small${c.inScope ? "" : " muted"}`}>
                  {c.title}:{" "}
                  {c.present
                    ? t.step5.present
                    : c.inScope
                      ? t.step5.missing
                      : t.step5.outOfScope(libraryInfo(c.library, locale).kind)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {missed.length > 0 || mismatched.length > 0 ? (
        <div className="error-strip" style={{ marginTop: 8 }} data-testid="spot-check-failed">
          {t.step5.failed}{" "}
          {mismatched.length > 0 ? t.step5.accuracyFail : ""}
          {missed.length > 0 ? t.step5.completenessFail : ""}
          {" "}{t.step5.challengeReady}
        </div>
      ) : (
        <p className="small muted tight" style={{ marginTop: 8 }}>
          {t.step5.spotCheckNote}
        </p>
      )}
    </div>
  );
}

// 挑战书 + counter-evidence handed to the jury. All plaintext is shown in
// full; only its hash is committed on-chain, so anyone can verify the
// plaintext was not altered. challenge.counterEvidenceHash is that commitment.
function ChallengeMaterials({
  task,
  challenge
}: {
  task: Task;
  challenge: TaskChallenge;
}) {
  const { locale, t } = useI18n();
  const counterEvidence = getPresetCounterEvidence(locale);
  const challengeDocument = getPresetChallengeDocument(locale);
  const counterLibrary = libraryInfo(counterEvidence.sourceLibrary as LibraryId, locale);

  return (
    <div className="challenge-materials" style={{ marginTop: 14 }}>
      <p className="section-kicker" style={{ margin: "0 0 8px" }}>
        {t.step5.challengePackage}
      </p>
      <div className="data-row">
        <span className="data-label">{t.step5.providerDelivery}</span>
        <div className="data-value">
          {task.providerPackage
            ? `${task.providerPackage.providerName} · ${t.step5.sourceItems(task.providerPackage.answers.length)}`
            : "—"}
        </div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.challengeType}</span>
        <div className="data-value">
          <span className="mono">{challenge.type}</span>
          <span className="muted small"> - {t.step5.inScopeMiss}</span>
        </div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.challengerStatement}</span>
        <div className="data-value">{challenge.statement}</div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.hitCoverage}</span>
        <div className="data-value">{challenge.hitCoverageClause}</div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.counterEvidenceSource}</span>
        <div className="data-value">
          {counterEvidence.sourceTitle}
          <span className="muted small mono"> ({counterEvidence.sourceLocator})</span>
        </div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.counterEvidenceLibrary}</span>
        <div className="data-value">
          {counterLibrary.name}
          <span className="muted small">
            {" "}· {counterLibrary.access}
          </span>
        </div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.counterEvidenceClaim}</span>
        <div className="data-value">{counterEvidence.claim}</div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.counterEvidenceHash}</span>
        <div className="data-value mono">{challenge.counterEvidenceHash}</div>
      </div>
      <div className="data-row" style={{ marginTop: 6 }}>
        <span className="data-label">{t.step5.juryBasis}</span>
        <div className="data-value">{challengeDocument.juryAssignmentBasis}</div>
      </div>
      <p className="small muted tight" style={{ marginTop: 6 }}>
        {t.step5.materialsNote}
      </p>
    </div>
  );
}

// The provider's defense statement (应辩书), filed within the defense window.
function DefenseCard({ challenge }: { challenge: TaskChallenge }) {
  const { t } = useI18n();
  const defense = challenge.defense;
  const txLink = defense?.txHash && isFullTxHash(defense.txHash) ? injectiveTxUrl(defense.txHash) : null;
  return (
    <div className="challenge-materials" style={{ marginTop: 14 }} data-testid="defense-card">
      <p className="section-kicker" style={{ margin: "0 0 8px" }}>
        {t.step5.defenseTitle}
      </p>
      {defense ? (
        <>
          <div className="data-row">
            <span className="data-label">{t.step5.defenseStatement}</span>
            <div className="data-value">{defense.statement}</div>
          </div>
          <div className="data-row" style={{ marginTop: 6 }}>
            <span className="data-label">{t.step5.defenseHash}</span>
            <div className="data-value mono">
              {txLink ? (
                <a
                  className="hash"
                  href={txLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t.step5.viewDefenseTx}
                >
                  {defense.defenseHash}
                </a>
              ) : (
                defense.defenseHash
              )}
            </div>
          </div>
          <p className="small muted tight" style={{ marginTop: 6 }}>
            {t.step5.defenseNote}
          </p>
          {challenge.type === "CoverageMiss" ? (
            <p className="small muted tight" style={{ marginTop: 4 }}>
              {t.step5.defenseScopeNote}
            </p>
          ) : null}
        </>
      ) : (
        <div className="info-strip">{t.step5.defenseMissing}</div>
      )}
    </div>
  );
}

// One juror's reasoned vote: model family, direction, and the three-question
// reason book whose hash went on-chain with the castVote transaction.
function JuryVoteCard({ vote, index }: { vote: JuryVote; index: number }) {
  const { t } = useI18n();
  const isFault = vote.vote === "ProviderFault";
  const txLink = vote.txHash && isFullTxHash(vote.txHash) ? injectiveTxUrl(vote.txHash) : null;
  return (
    <details className="evidence-item-row" data-testid={`jury-vote-${vote.jurorId}`} open={index === 0}>
      <summary className="evidence-item-summary">
        <span className="evidence-item-index">{index + 1}</span>
        <span className="evidence-item-title">
          {t.step5.juror(index)}
          {vote.jurorAddress ? (
            <span className="muted small mono"> ({vote.jurorAddress.slice(0, 10)}...)</span>
          ) : null}
        </span>
        <span className={`status-badge ${isFault ? "danger" : "warning"}`}>
          {isFault ? "ProviderFault" : "NotFault"}
        </span>
      </summary>
      <div className="evidence-item-body">
        <div className="data-row">
          <span className="data-label">{t.step5.originalCheck}</span>
          <div className="data-value">{vote.reasonBook.sourceCheck}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.inScope}</span>
          <div className="data-value">{vote.reasonBook.inScope}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.hitsDeclared}</span>
          <div className="data-value">{vote.reasonBook.hitsDeclaredQuery}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.notReturned}</span>
          <div className="data-value">{vote.reasonBook.notReturnedNotExcluded}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.verdictConclusion}</span>
          <div className="data-value">{vote.reasonBook.conclusion}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.reasonHash}</span>
          <div className="data-value mono">{vote.reasonHash}</div>
        </div>
        {txLink && (
          <div className="data-row">
            <span className="data-label">{t.step5.voteTx}</span>
            <div className="data-value">
              <a
                className="hash"
                href={txLink}
                target="_blank"
                rel="noreferrer"
                aria-label={t.step5.viewVoteTx(vote.jurorId)}
              >
                {shortHash(vote.txHash!)}
              </a>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

type Step5EvidenceProps = {
  task: Task | null;
  onVerify: () => void;
  onOpenChallenge: () => void;
  onRequestVote: () => void;
  onResolve: () => void;
  isBusy?: boolean;
  readOnly?: boolean;
};

// Extract verdictHash from an audit event message. The message may contain
// patterns like "verdictHash=0x..." or just a hash embedded in the text.
function extractVerdictHash(message: string): string | null {
  const explicit = message.match(/verdictHash=([0-9a-fA-Fx]+)/);
  if (explicit?.[1]) return explicit[1];
  // Fallback: any full 0x + 64-hex hash in the message.
  const embedded = message.match(/0x[0-9a-fA-F]{64}/);
  if (embedded?.[0]) return embedded[0];
  return null;
}

function findVerdictHash(task: Task | null): string | null {
  if (!task) return null;
  for (const event of task.audit) {
    if (
      event.type === "verification_passed" ||
      event.type === "settlement" ||
      event.type === "verified"
    ) {
      const h = extractVerdictHash(event.message);
      if (h) return h;
    }
  }
  // Try any audit event that carries a txHash and relates to verification.
  for (const event of task.audit) {
    if (event.type.includes("verif") || event.type.includes("verdict")) {
      if (isFullTxHash(event.txHash)) return event.txHash;
      const h = extractVerdictHash(event.message);
      if (h) return h;
    }
  }
  return null;
}

function statusLabel(task: Task | null, t: ReturnType<typeof useI18n>["t"]): { text: string; tone: "ok" | "pending" | "danger" } {
  switch (task?.status) {
    case "Verified":
      return { text: t.step5.status.Verified, tone: "ok" };
    case "Challenged":
      return { text: t.step5.status.Challenged, tone: "danger" };
    case "ChallengeWon":
      return { text: t.step5.status.ChallengeWon, tone: "danger" };
    case "ChallengeLost":
      return { text: t.step5.status.ChallengeLost, tone: "ok" };
    case "RefundedOrSlashed":
      return { text: t.step5.status.RefundedOrSlashed, tone: "danger" };
    default:
      return { text: t.step5.status.default, tone: "pending" };
  }
}

// Expandable evidence item using native <details>/<summary>.
function EvidenceItem({
  index,
  answer,
  defaultOpen = false,
}: {
  index: number;
  defaultOpen?: boolean;
  answer: {
    providerAnswer: string;
    sourceTitle: string;
    sourceLocator: string;
    sourceLibrary: string;
    sourceMetadata: { year: number; type: string };
    excerptOrSummary: string;
    relevanceExplanation: string;
  };
}) {
  const { locale, t } = useI18n();
  const sourceLibrary = libraryInfo(answer.sourceLibrary as LibraryId, locale);

  return (
    <details className="evidence-item-row" open={defaultOpen}>
      <summary className="evidence-item-summary">
        <span className="evidence-item-index">{index + 1}</span>
        <span className="evidence-item-title">{answer.sourceTitle}</span>
        <span className="evidence-item-locator mono">{answer.sourceLocator}</span>
      </summary>
      <div className="evidence-item-body">
        <div className="data-row">
          <span className="data-label">{t.step5.expertConclusion}</span>
          <div className="data-value">{answer.providerAnswer}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.sourceLocator}</span>
          <div className="data-value mono">{answer.sourceLocator}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.sourceLibrary}</span>
          <div className="data-value">
            {sourceLibrary.name ?? answer.sourceLibrary}
            <span className="muted small">
              {" "}· {sourceLibrary.kind ?? ""}
            </span>
          </div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.yearType}</span>
          <div className="data-value">
            <span className="mono">{answer.sourceMetadata.year}</span>
            {" / "}
            {answer.sourceMetadata.type}
          </div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.excerpt}</span>
          <div className="data-value">{answer.excerptOrSummary}</div>
        </div>
        <div className="data-row">
          <span className="data-label">{t.step5.relevance}</span>
          <div className="data-value">{answer.relevanceExplanation}</div>
        </div>
      </div>
    </details>
  );
}

function buildBriefSummary(pkg: NonNullable<Task["providerPackage"]>, t: ReturnType<typeof useI18n>["t"]): {
  headline: string;
  sourceLine: string;
  caveat: string;
} {
  const first = pkg.answers[0];
  if (!first) {
    return {
      headline: t.step5.emptyHeadline,
      sourceLine: t.step5.emptySource,
      caveat: t.step5.emptyCaveat
    };
  }

  const sourceLine = t.step5.sourceCount(pkg.answers.length, first.sourceTitle);
  const caveat =
    pkg.answers
      .map((a) => a.relevanceExplanation)
      .find((text) => /不能|无法|局限|但|however|cannot|does not/i.test(text)) ??
    t.step5.defaultCaveat;

  return {
    headline: first.providerAnswer,
    sourceLine,
    caveat
  };
}

// Renders a tx row for challenge-related records.
function ChallengeTxRow({ record }: { record: TxRecord }) {
  const { t } = useI18n();
  const label = t.step4.txLabels[record.label] ?? record.label;
  const isConfirmed = record.status === "confirmed";
  const isPending = record.status === "pending";
  const isFailed = record.status === "failed";
  const hasLink = isConfirmed && isFullTxHash(record.txHash);

  return (
    <div
      className={`tx-progress-row ${record.status}`}
      aria-label={`${label}: ${record.status}`}
    >
      <div className="tx-row-left">
        <span className="tx-label">{label}</span>
        <span className="tx-sublabel">
          {hasLink ? (
            <a
              className="hash"
              href={injectiveTxUrl(record.txHash)}
              target="_blank"
              rel="noreferrer"
              aria-label={`${t.common.viewOnInjective}: ${label}`}
            >
              {shortHash(record.txHash)}
            </a>
          ) : isPending ? (
            <span className="tx-pending-text muted small">{t.common.running}</span>
          ) : isFailed ? (
            <span className="muted small">{t.common.txFailed}</span>
          ) : (
            <span className="muted small">{t.common.waitingBroadcast}</span>
          )}
        </span>
      </div>
      <div className="tx-row-right">
        {isConfirmed && <span className="status-badge success">{t.common.confirmed}</span>}
        {isPending && <span className="status-badge warning">{t.common.pending}</span>}
        {isFailed && <span className="status-badge danger">{t.common.failed}</span>}
      </div>
    </div>
  );
}

// Stage 1:挑战已发起 (status = Challenged)
function ChallengeStage1({
  task,
  challenge,
  onRequestVote,
  isBusy,
  readOnly,
}: {
  task: Task;
  challenge: TaskChallenge;
  onRequestVote: () => void;
  isBusy: boolean;
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const challengeTxRecords = task.txRecords.filter(
    (r) => r.label === "approveDeposit" || r.label === "openChallenge" || r.label === "defense"
  );
  const isRealMode = task.mode === "real";

  return (
    <div className="challenge-stage" aria-label={t.step5.stageOpened}>
      <div className="challenge-stage-header">
        <span className="dot danger" aria-hidden="true" />
        <strong>{t.step5.stageOpened}</strong>
      </div>

      <div className="challenge-stage-body">
        {/* Challenge metadata */}
        <div className="data-row">
          <span className="data-label">{t.step5.challengeType}</span>
          <div className="data-value">
            <span className="mono">{challenge.type}</span>
            <span className="muted small"> - {t.step5.inScopeMiss}</span>
          </div>
        </div>
        <div className="data-row" style={{ marginTop: 6 }}>
          <span className="data-label">{t.step5.deposit}</span>
          <div className="data-value">
            <span className="dot danger" style={{ verticalAlign: "middle", marginRight: 6 }} aria-hidden="true" />
            {t.step5.depositValue}
          </div>
        </div>
        <div className="data-row" style={{ marginTop: 6 }}>
          <span className="data-label">{t.step5.juryFee}</span>
          <div className="data-value">
            <span className="dot danger" style={{ verticalAlign: "middle", marginRight: 6 }} aria-hidden="true" />
            {t.step5.juryFeeValue}
          </div>
        </div>
        <div className="data-row" style={{ marginTop: 6 }}>
          <span className="data-label">{t.step5.escrowOrder}</span>
          <div className="data-value">
            <span className="dot pending" style={{ verticalAlign: "middle", marginRight: 6 }} aria-hidden="true" />
            {t.step5.frozen}
          </div>
        </div>

        {/* Real mode: on-chain tx records */}
        {isRealMode && challengeTxRecords.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p className="section-kicker" style={{ margin: "0 0 6px" }}>{t.step5.chainTx}</p>
            <div className="tx-progress-list">
              {challengeTxRecords.map((record, i) => (
                <ChallengeTxRow key={`${record.label}-${i}`} record={record} />
              ))}
            </div>
          </div>
        )}

        {/* 挑战书 for the jury */}
        <ChallengeMaterials task={task} challenge={challenge} />

        {/* Provider 应辩书 */}
        <DefenseCard challenge={challenge} />

        {/* Action */}
        {!readOnly && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={onRequestVote}
              disabled={isBusy}
              aria-busy={isBusy ? "true" : undefined}
            >
              {isBusy ? t.step5.verdictBusy : t.step5.requestVerdict}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Stage 2: 陪审员投票已完成 (status = ChallengeWon)
function ChallengeStage2({
  task,
  challenge,
  votes,
  onResolve,
  isBusy,
  readOnly,
}: {
  task: Task;
  challenge: TaskChallenge;
  votes: JuryVote[];
  onResolve: () => void;
  isBusy: boolean;
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const faultVotes = votes.filter((vote) => vote.vote === "ProviderFault").length;
  const dissent = votes.length - faultVotes;

  return (
    <div className="challenge-stage" aria-label={t.step5.juryResult(faultVotes, dissent)}>
      <div className="challenge-stage-header">
        <span className="dot danger" aria-hidden="true" />
        <strong>
          {t.step5.juryResult(faultVotes, dissent)}
        </strong>
      </div>

      <div className="challenge-stage-body">
        <p className="small muted tight" style={{ margin: "0 0 8px" }}>
          {t.step5.juryResultNote}
        </p>
        <div className="evidence-items-list">
          {votes.map((vote, i) => (
            <JuryVoteCard key={vote.jurorId} vote={vote} index={i} />
          ))}
        </div>
        <p className="small muted tight" style={{ marginTop: 8 }}>
          {t.step5.jurorCommitmentNote}
        </p>

        {/* Materials panel (still visible for reference) */}
        <ChallengeMaterials task={task} challenge={challenge} />
        <DefenseCard challenge={challenge} />

        {/* Action */}
        {!readOnly && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={onResolve}
              disabled={isBusy}
              aria-busy={isBusy ? "true" : undefined}
            >
              {isBusy ? t.step5.executingVerdict : t.step5.executeVerdict}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Stage 3: 裁决已执行 (status = RefundedOrSlashed)
function ChallengeStage3({
  task,
  challenge,
}: {
  task: Task;
  challenge: TaskChallenge;
}) {
  const { t } = useI18n();
  const isRealMode = task.mode === "real";
  const resolveRecord = task.txRecords.find((r) => r.label === "resolve");
  const resolvedTxHash = challenge.resolvedTxHash ?? resolveRecord?.txHash;
  const hasInjectiveExplorerLink = isRealMode && resolvedTxHash && isFullTxHash(resolvedTxHash);

  return (
    <div className="challenge-stage challenge-stage--resolved" aria-label={t.step5.resolved}>
      <div className="challenge-stage-header">
        <span className="dot ok" aria-hidden="true" />
        <strong>{t.step5.resolved}</strong>
      </div>

      <div className="challenge-stage-body">
        {/* Fund actions — one line per effect (§4.3 资金流) */}
        <div className="challenge-fund-actions">
          {t.step5.fundActions.map((action) => (
            <div className="challenge-fund-row" key={action}>
              <span className="challenge-fund-icon" aria-hidden="true">-</span>
              <span>{action}</span>
            </div>
          ))}
        </div>

        {/* Real mode: resolve tx */}
        {resolvedTxHash && (
          <div className="data-row" style={{ marginTop: 12 }}>
            <span className="data-label">{t.step5.resolvedTx}</span>
            <div className="data-value">
              {hasInjectiveExplorerLink ? (
                <a
                  className="hash"
                  href={injectiveTxUrl(resolvedTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t.step5.viewResolveTx}
                >
                  {shortHash(resolvedTxHash)}
                </a>
              ) : (
                <span className="mono">{resolvedTxHash}</span>
              )}
            </div>
          </div>
        )}

        {isRealMode && !resolvedTxHash && (
          <div style={{ marginTop: 12 }}>
            <div className="tx-progress-list">
              {task.txRecords
                .filter((r) => r.label === "resolve")
                .map((record, i) => (
                  <ChallengeTxRow key={`resolve-${i}`} record={record} />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Step5Evidence({
  task,
  onVerify,
  onOpenChallenge,
  onRequestVote,
  onResolve,
  isBusy = false,
  readOnly = false,
}: Step5EvidenceProps) {
  const { t } = useI18n();
  const providerPackage = task?.providerPackage ?? null;
  const status = task?.status;
  const isDelivered = status === "Delivered";
  const isRealMode = task?.mode === "real";
  // Challenge window W_c countdown — drives the banner under Delivered.
  const windowRemaining = useCountdown(task?.challengeWindowEndsAt);

  const { text: statusText, tone: statusTone } = statusLabel(task, t);
  const verdictHash = findVerdictHash(task);

  // Submit tx for package hash etherscan link
  const submitRecord = task?.txRecords?.find((r) => r.label === "submit");
  const submitTxLink =
    submitRecord && isFullTxHash(submitRecord.txHash)
      ? injectiveTxUrl(submitRecord.txHash)
      : null;

  const challenge = task?.challenge ?? null;
  const briefSummary = providerPackage ? buildBriefSummary(providerPackage, t) : null;

  // Determine which challenge stage we are in
  const isChallenged = status === "Challenged";
  const isChallengeWon = status === "ChallengeWon";
  const isRefundedOrSlashed = status === "RefundedOrSlashed";
  const isInChallengeFlow = isChallenged || isChallengeWon || isRefundedOrSlashed;

  // Primary action for the success path
  let primary: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean } | undefined;
  let secondary: { label: string; onClick: () => void; disabled?: boolean } | undefined;

  if (!readOnly && isDelivered) {
    primary = {
      label: t.step5.verify,
      onClick: onVerify,
      disabled: isBusy,
      busy: isBusy,
    };
    // Secondary: low-key challenge entry; when the agent's spot check failed
    // (coverage miss OR excerpt mismatch), the same action ships the
    // pre-built challenge package.
    secondary = {
      label:
        providerPackage && packageFailsSpotCheck(providerPackage)
          ? t.step5.buildChallenge
          : t.step5.challenge,
      onClick: onOpenChallenge,
      disabled: isBusy,
    };
  }
  // When in challenge flow, no top-level primary — actions are inline in the stage.

  return (
    <StepShell
      stepNo={5}
      title={t.step5.title}
      subtitle={
        isInChallengeFlow
          ? t.step5.status.Challenged
          : t.step5.subtitle
      }
      primary={primary}
      secondary={secondary}
    >
      {/* ── 证据包 ─────────────────────────────────── */}
      {providerPackage ? (
        <div className="evidence-section">
          {briefSummary ? (
            <div className="brief-summary">
              <p className="section-kicker" style={{ margin: "0 0 8px" }}>
                {t.step5.packageSummary}
              </p>
              <div className="data-grid">
                <div className="data-row">
                  <span className="data-label">{t.step5.conclusion}</span>
                  <div className="data-value">{briefSummary.headline}</div>
                </div>
                <div className="data-row">
                  <span className="data-label">{t.step5.sourceLine}</span>
                  <div className="data-value">{briefSummary.sourceLine}</div>
                </div>
                <div className="data-row">
                  <span className="data-label">{t.step5.caveat}</span>
                  <div className="data-value muted">{briefSummary.caveat}</div>
                </div>
              </div>
            </div>
          ) : null}

          <p className="section-kicker" style={{ margin: "0 0 4px" }}>
            {t.step5.evidenceItems}
          </p>
          <p className="small muted tight" style={{ margin: "0 0 10px" }}>
            {t.step2.deliverableValue}
          </p>

          {/* Provider header */}
          <div className="data-row" style={{ marginBottom: 8 }}>
            <span className="data-label">{t.step5.provider}</span>
            <div className="data-value">
              <strong>{providerPackage.providerName}</strong>
            </div>
          </div>
          <div className="data-row" style={{ marginBottom: 12 }}>
            <span className="data-label">{t.step5.coverage}</span>
            <div className="data-value">{providerPackage.coverageStatement}</div>
          </div>

          {/* Evidence items — expandable list */}
          {providerPackage.answers.length > 0 ? (
            <div className="evidence-items-list">
              {providerPackage.answers.map((answer, i) => (
                <EvidenceItem
                  key={answer.sourceLocator}
                  index={i}
                  answer={answer}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          ) : (
            <div className="info-strip">{t.step5.emptySource}</div>
          )}
        </div>
      ) : (
        <div className="info-strip">{t.step5.waitingPackage}</div>
      )}

      {/* ── 我方 Agent 抽查核验 ───────────────────────── */}
      {providerPackage && <AgentSpotCheck pkg={providerPackage} />}

      {/* ── 链上存证 ─────────────────────────────────── */}
      {providerPackage && (
        <div className="onchain-consistency" style={{ marginTop: 20 }}>
          <p className="section-kicker" style={{ margin: "0 0 8px" }}>
            {t.step5.hashCheck}
          </p>
          <div className="data-row">
            <span className="data-label">{t.step5.packageHash}</span>
            <div className="data-value">
              {submitTxLink ? (
                <a
                  className="hash"
                  href={submitTxLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${t.common.viewOnInjective}: ${t.step5.packageHash}`}
                >
                  {providerPackage.packageHash}
                </a>
              ) : (
                <span className="mono">{providerPackage.packageHash}</span>
              )}
            </div>
          </div>
          {(() => {
            // Real recomputation behind a one-line product status: rebuild the
            // commitment from the received plaintext and compare to the root
            // the provider signed on-chain. Structure details stay out of the
            // product page by design (they live in the design doc / script).
            const rootMatches =
              buildPackageCommitment(providerPackage).root ===
              providerPackage.packageHash;
            return (
              <div className="data-row" style={{ marginTop: 6 }}>
                <span className="data-label">{t.step5.hashCheck}</span>
                <div className="data-value">
                  <span className="dot-inline-wrap">
                    <span className={`dot ${rootMatches ? "ok" : "danger"}`} aria-hidden="true" />
                    <span className="small">
                      {rootMatches
                        ? t.step5.hashCheckValue
                        : t.step5.hashCheckMismatch}
                    </span>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── 验证结论 ─────────────────────────────────── */}
      <div className="verification-result" style={{ marginTop: 20 }}>
        <p className="section-kicker" style={{ margin: "0 0 8px" }}>
          {t.step5.status.Verified}
        </p>
        <div className="data-row">
          <span className="data-label">{t.landing.status}</span>
          <div className="data-value">
            <span className="dot-inline-wrap">
              <span className={`dot ${statusTone}`} aria-hidden="true" />
              <span>{statusText}</span>
            </span>
          </div>
        </div>

        {verdictHash && (
          <div className="data-row" style={{ marginTop: 6 }}>
            <span className="data-label">{t.step6.verdictHash}</span>
            <div className="data-value mono">{verdictHash}</div>
          </div>
        )}

        {(status === "Verified" || (status as string) === "Settled" || (status as string) === "Audited") &&
          !verdictHash && (
            <div className="data-row" style={{ marginTop: 6 }}>
              <span className="data-label">{t.step5.verify}</span>
              <div className="data-value">{t.common.confirmed}</div>
            </div>
          )}
        <p className="small muted tight" style={{ marginTop: 6 }}>
          {t.step5.spotCheckNote}
        </p>
      </div>

      {/* ── 确定性挑战流程 ──────────────────────────────── */}
      {isInChallengeFlow && challenge && (
        <div className="challenge-section" style={{ marginTop: 24 }}>
          <p className="section-kicker" style={{ margin: "0 0 10px" }}>
            {t.step5.challenge}
          </p>

          {/* Stage 1: Challenged */}
          {isChallenged && (
            <ChallengeStage1
              task={task!}
              challenge={challenge}
              onRequestVote={onRequestVote}
              isBusy={isBusy}
              readOnly={readOnly}
            />
          )}

          {/* Stage 2: ChallengeWon — jury verdict rendered */}
          {isChallengeWon && challenge.votes && challenge.votes.length > 0 && (
            <ChallengeStage2
              task={task!}
              challenge={challenge}
              votes={challenge.votes}
              onResolve={onResolve}
              isBusy={isBusy}
              readOnly={readOnly}
            />
          )}

          {/* ChallengeWon but no votes yet (edge case in real mode, show waiting) */}
          {isChallengeWon && (!challenge.votes || challenge.votes.length === 0) && (
            <div className="challenge-stage" aria-label={t.step5.verdictBusy}>
              <div className="challenge-stage-header">
                <span className="dot pending" aria-hidden="true" />
                <strong>{t.step5.verdictBusy}</strong>
              </div>
              <div className="challenge-stage-body">
                <div className="info-strip">{t.common.pending}</div>
              </div>
            </div>
          )}

          {/* Stage 3: RefundedOrSlashed — terminal */}
          {isRefundedOrSlashed && (
            <ChallengeStage3
              task={task!}
              challenge={challenge}
            />
          )}
        </div>
      )}

      {/* ── 挑战窗口与挑战说明（real 模式）──────────────────── */}
      {isDelivered && isRealMode && (
        <div className="info-strip" style={{ marginTop: 16 }} data-testid="challenge-window-banner">
          <span className="small">
            {windowRemaining > 0 ? (
              <>
                {t.step5.challengeWindow} <span className="mono">{formatCountdown(windowRemaining)}</span>. {t.step5.challengeWindowNote}
              </>
            ) : task?.challengeWindowEndsAt ? (
              <>{t.step5.challengeWindowClosed}.</>
            ) : null}
            {" "}{t.step5.challengeWindowNote}
          </span>
        </div>
      )}

      {/* Terminal state: offer audit review */}
      {isRefundedOrSlashed && (
        <div className="info-strip" style={{ marginTop: 16 }}>
          <span className="small muted">
            {t.step5.completed}
          </span>
        </div>
      )}
    </StepShell>
  );
}
