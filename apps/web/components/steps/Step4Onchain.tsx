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
  createJob: "创建专家订单",
  setBudget: "设定预算",
  fund: "锁定托管资金",
  submit: "提交简报",
  complete: "结算放款",
  approveDeposit: "授权押金 + 陪审费",
  openChallenge: "发起挑战",
  defense: "提交应辩书",
  castVote: "陪审投票",
  resolve: "执行裁决",
  feedback: "链上信誉反馈"
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

  // Gate 获取研究简报 on task status, not on txRecords contents.
  // In fixture mode txRecords stays [] even after JobFunded; real mode
  // populates all 4 confirmed rows.  Either way, status === "JobFunded"
  // is the canonical signal that escrow is complete.
  const isJobFunded = task?.status === "JobFunded";

  return (
    <StepShell
      stepNo={4}
      title="采购执行中"
      subtitle="专家订单正在执行。普通用户只需等简报返回；需要核验时可展开每笔测试网交易。"
      primary={
        isJobFunded
          ? {
              label: "获取研究简报",
              onClick: onGetEvidence,
              disabled: isBusy,
              busy: isBusy
            }
          : undefined
      }
    >
      {records.length > 0 ? (
        // Real mode: show the 4 confirmed tx rows with Etherscan links.
        <div className="tx-progress-list">
          {records.map((record, index) => (
            <TxRow key={`${record.label}-${index}`} record={record} />
          ))}
        </div>
      ) : isJobFunded ? (
        // Fixture mode: status is JobFunded but no on-chain tx details.
        <div className="info-strip">本地模拟模式：已完成采购执行，没有测试网交易明细。</div>
      ) : (
        // Genuinely mid-execute: waiting for chain confirmation.
        <div className="info-strip">等待采购执行完成…</div>
      )}

      {!isJobFunded && records.length > 0 && (
        <div className="info-strip">
          采购执行确认中，完成后可获取研究简报。
        </div>
      )}
    </StepShell>
  );
}
