import React from "react";
import type { TxRecord } from "@proofmarket/shared/src/realMode";
import type { Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, sepoliaTxUrl, shortHash } from "../../lib/links";
import { StepShell } from "../StepShell";

type Step4OnchainProps = {
  task: Task | null;
  onGetEvidence: () => void;
  isBusy?: boolean;
};

// The 4 core escrow transactions this step is about.
const ESCROW_LABELS: TxRecord["label"][] = ["approve", "createJob", "setBudget", "fund"];

// Human-readable Chinese labels for each transaction step.
const TX_LABEL_MAP: Record<TxRecord["label"], string> = {
  approve: "授权代币",
  createJob: "创建订单",
  setBudget: "设定预算",
  fund: "注入托管资金",
  submit: "提交证据",
  complete: "结算放款"
};

function TxRow({ record }: { record: TxRecord }) {
  const chineseLabel = TX_LABEL_MAP[record.label] ?? record.label;
  const isPending = record.status === "pending";
  const isConfirmed = record.status === "confirmed";
  const isFailed = record.status === "failed";
  const hasLink = isConfirmed && isFullTxHash(record.txHash);

  return (
    <div
      className={`tx-progress-row ${record.status}`}
      aria-label={`${chineseLabel}：${record.status}`}
    >
      <div className="tx-row-left">
        <span className="tx-label">{chineseLabel}</span>
        <span className="tx-sublabel">
          {hasLink ? (
            <a
              className="hash"
              href={sepoliaTxUrl(record.txHash)}
              target="_blank"
              rel="noreferrer"
              aria-label={`在 Etherscan 查看 ${chineseLabel} 交易`}
            >
              {shortHash(record.txHash)}
            </a>
          ) : isPending ? (
            <span className="tx-pending-text muted small" aria-live="polite">
              进行中…
            </span>
          ) : isFailed ? (
            <span className="muted small">交易失败</span>
          ) : (
            <span className="muted small">等待广播</span>
          )}
        </span>
      </div>
      <div className="tx-row-right">
        {isConfirmed && (
          <span className="status-badge success">已确认</span>
        )}
        {isPending && (
          <span className="status-badge warning">进行中</span>
        )}
        {isFailed && (
          <span className="status-badge danger">失败</span>
        )}
      </div>
    </div>
  );
}

export function Step4Onchain({
  task,
  onGetEvidence,
  isBusy = false
}: Step4OnchainProps) {
  const records = task?.txRecords ?? [];

  // All 4 escrow records confirmed = ready to fetch evidence.
  const escrowRecords = records.filter((r) =>
    (ESCROW_LABELS as string[]).includes(r.label)
  );
  const allEscrowConfirmed =
    escrowRecords.length === ESCROW_LABELS.length &&
    escrowRecords.every((r) => r.status === "confirmed");

  return (
    <StepShell
      stepNo={4}
      title="链上采购进行中"
      subtitle="资金正在 Sepolia 测试网上按 Cobo 边界托管。每一步都是真实交易，可点开核验。"
      primary={
        allEscrowConfirmed
          ? {
              label: "获取证据",
              onClick: onGetEvidence,
              disabled: isBusy,
              busy: isBusy
            }
          : undefined
      }
    >
      {records.length === 0 ? (
        <div className="info-strip">等待链上确认…</div>
      ) : (
        <div className="tx-progress-list">
          {records.map((record, index) => (
            <TxRow key={`${record.label}-${index}`} record={record} />
          ))}
        </div>
      )}

      {!allEscrowConfirmed && records.length > 0 && (
        <div className="info-strip">
          托管交易确认中，完成后可获取证据。
        </div>
      )}
    </StepShell>
  );
}
