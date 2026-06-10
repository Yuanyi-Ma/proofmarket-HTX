import React from "react";
import type { Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, sepoliaTxUrl } from "../../lib/links";
import { StepShell } from "../StepShell";

type Step5EvidenceProps = {
  task: Task | null;
  onVerify: () => void;
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

function statusLabel(task: Task | null): { text: string; tone: "ok" | "pending" | "danger" } {
  switch (task?.status) {
    case "Verified":
      return { text: "验证通过", tone: "ok" };
    case "Challenged":
      return { text: "挑战中", tone: "danger" };
    case "ChallengeWon":
      return { text: "挑战成立", tone: "danger" };
    case "ChallengeLost":
      return { text: "挑战驳回", tone: "ok" };
    case "RefundedOrSlashed":
      return { text: "已退款 / 已惩罚", tone: "danger" };
    default:
      return { text: "等待核验", tone: "pending" };
  }
}

// Expandable evidence item using native <details>/<summary>.
function EvidenceItem({
  index,
  answer,
}: {
  index: number;
  answer: {
    providerAnswer: string;
    sourceTitle: string;
    sourceLocator: string;
    sourceMetadata: { year: number; type: string };
    excerptOrSummary: string;
    relevanceExplanation: string;
  };
}) {
  return (
    <details className="evidence-item-row">
      <summary className="evidence-item-summary">
        <span className="evidence-item-index">{index + 1}</span>
        <span className="evidence-item-title">{answer.sourceTitle}</span>
        <span className="evidence-item-locator mono">{answer.sourceLocator}</span>
      </summary>
      <div className="evidence-item-body">
        <div className="data-row">
          <span className="data-label">Provider 回答</span>
          <div className="data-value">{answer.providerAnswer}</div>
        </div>
        <div className="data-row">
          <span className="data-label">来源定位</span>
          <div className="data-value mono">{answer.sourceLocator}</div>
        </div>
        <div className="data-row">
          <span className="data-label">年份 / 类型</span>
          <div className="data-value">
            <span className="mono">{answer.sourceMetadata.year}</span>
            {" / "}
            {answer.sourceMetadata.type}
          </div>
        </div>
        <div className="data-row">
          <span className="data-label">摘录 / 摘要</span>
          <div className="data-value">{answer.excerptOrSummary}</div>
        </div>
        <div className="data-row">
          <span className="data-label">相关性说明</span>
          <div className="data-value">{answer.relevanceExplanation}</div>
        </div>
      </div>
    </details>
  );
}

export function Step5Evidence({
  task,
  onVerify,
  isBusy = false,
  readOnly = false,
}: Step5EvidenceProps) {
  const providerPackage = task?.providerPackage ?? null;
  const status = task?.status;
  const isDelivered = status === "Delivered";

  const { text: statusText, tone: statusTone } = statusLabel(task);
  const verdictHash = findVerdictHash(task);

  // Submit tx for package hash etherscan link
  const submitRecord = task?.txRecords?.find((r) => r.label === "submit");
  const submitTxLink =
    submitRecord && isFullTxHash(submitRecord.txHash)
      ? sepoliaTxUrl(submitRecord.txHash)
      : null;

  let primary: { label: string; onClick: () => void; disabled?: boolean; busy?: boolean } | undefined;

  if (!readOnly && isDelivered) {
    primary = {
      label: "核验证据",
      onClick: onVerify,
      disabled: isBusy,
      busy: isBusy,
    };
    // Verified is handled by step 6 now (stepFor maps Verified→6).
  }

  return (
    <StepShell
      stepNo={5}
      title="证据与核验"
      subtitle="Provider 已交付带证据包的回答。核验通过后即可结算。"
      primary={primary}
    >
      {/* ── 证据包 ─────────────────────────────────── */}
      {providerPackage ? (
        <div className="evidence-section">
          <p className="section-kicker" style={{ margin: "0 0 8px" }}>
            证据包
          </p>

          {/* Provider header */}
          <div className="data-row" style={{ marginBottom: 8 }}>
            <span className="data-label">Provider</span>
            <div className="data-value">
              <strong>{providerPackage.providerName}</strong>
            </div>
          </div>
          <div className="data-row" style={{ marginBottom: 12 }}>
            <span className="data-label">覆盖声明</span>
            <div className="data-value">{providerPackage.coverageStatement}</div>
          </div>

          {/* Evidence items — expandable list */}
          {providerPackage.answers.length > 0 ? (
            <div className="evidence-items-list">
              {providerPackage.answers.map((answer, i) => (
                <EvidenceItem key={answer.sourceLocator} index={i} answer={answer} />
              ))}
            </div>
          ) : (
            <div className="info-strip">证据包中暂无具体条目。</div>
          )}
        </div>
      ) : (
        <div className="info-strip">等待 Provider 交付证据包…</div>
      )}

      {/* ── 链上一致性 ───────────────────────────────── */}
      {providerPackage && (
        <div className="onchain-consistency" style={{ marginTop: 20 }}>
          <p className="section-kicker" style={{ margin: "0 0 8px" }}>
            链上一致性
          </p>
          <div className="data-row">
            <span className="data-label">证据包哈希</span>
            <div className="data-value">
              {submitTxLink ? (
                <a
                  className="hash"
                  href={submitTxLink}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="在 Etherscan 查看证据包提交交易"
                >
                  {providerPackage.packageHash}
                </a>
              ) : (
                <span className="mono">{providerPackage.packageHash}</span>
              )}
            </div>
          </div>
          <p className="small muted tight" style={{ marginTop: 6 }}>
            证据包哈希已写入链上，任何人均可核对。
          </p>
        </div>
      )}

      {/* ── 验证结论 ─────────────────────────────────── */}
      <div className="verification-result" style={{ marginTop: 20 }}>
        <p className="section-kicker" style={{ margin: "0 0 8px" }}>
          验证结论
        </p>
        <div className="data-row">
          <span className="data-label">当前状态</span>
          <div className="data-value">
            <span className="dot-inline-wrap">
              <span className={`dot ${statusTone}`} aria-hidden="true" />
              <span>{statusText}</span>
            </span>
          </div>
        </div>

        {verdictHash && (
          <div className="data-row" style={{ marginTop: 6 }}>
            <span className="data-label">Verdict 哈希</span>
            <div className="data-value mono">{verdictHash}</div>
          </div>
        )}

        {(status === "Verified" || (status as string) === "Settled" || (status as string) === "Audited") &&
          !verdictHash && (
            <div className="data-row" style={{ marginTop: 6 }}>
              <span className="data-label">Judge 判定</span>
              <div className="data-value">有效</div>
            </div>
          )}
      </div>

      {/* ── 挑战机制说明（诚实占位，完整流程待 08）────── */}
      <div className="challenge-note" style={{ marginTop: 24 }}>
        <p className="small muted tight">
          ProofMarket 也支持对可疑证据发起挑战——通过质押、挑战押金与仲裁机制约束
          Provider 作恶。完整的链上挑战流程开发中。
        </p>
      </div>
    </StepShell>
  );
}
