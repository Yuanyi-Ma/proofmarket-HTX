import React, { useEffect, useMemo, useState } from "react";
import { demoEscrowTxHashes } from "@proofmarket/shared/src/fixtures";
import type { TxRecord } from "@proofmarket/shared/src/realMode";
import type { Task } from "@proofmarket/shared/src/types";
import { isFullTxHash, injectiveTxUrl, shortHash } from "../../lib/links";
import { StepShell } from "../StepShell";
import { useI18n } from "../I18nProvider";

type Step4OnchainProps = {
  task: Task | null;
  onGetEvidence: () => void;
  isBusy?: boolean;
};

// The 4 core escrow transactions this step is about.
const ESCROW_LABELS = ["approve", "createJob", "setBudget", "fund"] as const satisfies readonly TxRecord["label"][];
const DEMO_TX_STEP_MS = 2500;
const DEMO_TX_HASH_BY_LABEL = demoEscrowTxHashes;

function demoEscrowRecords(taskId: string): TxRecord[] {
  return ESCROW_LABELS.map((label) => ({
    label,
    policySignerRequestId: `fixture-${taskId}-${label}`,
    txHash: DEMO_TX_HASH_BY_LABEL[label],
    status: "confirmed"
  }));
}

function recordMatchesFixture(taskId: string, record: TxRecord): boolean {
  return record.policySignerRequestId?.startsWith(`fixture-${taskId}-`) ?? false;
}

function stagedEscrowRecords(records: TxRecord[], confirmedCount: number): TxRecord[] {
  const output: TxRecord[] = [];
  for (const [index, label] of ESCROW_LABELS.entries()) {
    const record = records.find((entry) => entry.label === label);
    if (!record || index > confirmedCount) continue;
    if (index === confirmedCount) {
      output.push({
        ...record,
        txHash: "",
        status: "pending"
      });
      continue;
    }
    output.push({ ...record, status: "confirmed" });
  }
  return output;
}

function TxRow({ record }: { record: TxRecord }) {
  const { t } = useI18n();
  const label = t.step4.txLabels[record.label] ?? record.label;
  const isPending = record.status === "pending";
  const isConfirmed = record.status === "confirmed";
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
            <span className="tx-pending-text muted small" aria-live="polite">
              {t.common.running}
            </span>
          ) : isFailed ? (
            <span className="muted small">{t.common.txFailed}</span>
          ) : (
            <span className="muted small">{t.common.waitingBroadcast}</span>
          )}
        </span>
      </div>
      <div className="tx-row-right">
        {isConfirmed && (
          <span className="status-badge success">{t.common.confirmed}</span>
        )}
        {isPending && (
          <span className="status-badge warning">{t.common.pending}</span>
        )}
        {isFailed && (
          <span className="status-badge danger">{t.common.failed}</span>
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
  const { t } = useI18n();
  const records = task?.txRecords ?? [];
  const isJobFunded = task?.status === "JobFunded";
  const taskId = task?.id ?? "task";

  const escrowRecords = useMemo(() => {
    if (!isJobFunded) return records;
    return records.length > 0 ? records : demoEscrowRecords(taskId);
  }, [isJobFunded, records, taskId]);

  const shouldStageEscrow =
    task?.mode === "fixture" &&
    isJobFunded &&
    (
      records.length === 0 ||
      records.some((record) => recordMatchesFixture(taskId, record))
    );
  const animationKey = `${taskId}:${escrowRecords
    .map((record) => `${record.label}:${record.status}:${record.txHash}`)
    .join("|")}`;
  const [stage, setStage] = useState({ key: "", confirmedCount: 0 });
  const stagedConfirmedCount =
    shouldStageEscrow && stage.key === animationKey
      ? stage.confirmedCount
      : shouldStageEscrow
        ? 0
        : ESCROW_LABELS.length;
  const displayedRecords = shouldStageEscrow
    ? stagedEscrowRecords(escrowRecords, stagedConfirmedCount)
    : escrowRecords;
  const isStagingComplete =
    !shouldStageEscrow || stagedConfirmedCount >= ESCROW_LABELS.length;
  const canGetEvidence = isJobFunded && isStagingComplete;

  useEffect(() => {
    if (!shouldStageEscrow) {
      setStage({ key: animationKey, confirmedCount: ESCROW_LABELS.length });
      return;
    }

    setStage({ key: animationKey, confirmedCount: 0 });
    const timers = ESCROW_LABELS.map((_, index) =>
      window.setTimeout(() => {
        setStage((current) =>
          current.key === animationKey
            ? { key: animationKey, confirmedCount: index + 1 }
            : current
        );
      }, DEMO_TX_STEP_MS * (index + 1))
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [animationKey, shouldStageEscrow]);

  return (
    <StepShell
      stepNo={4}
      title={t.step4.title}
      subtitle={t.step4.subtitle}
      primary={
        canGetEvidence
          ? {
              label: t.step4.primary,
              onClick: onGetEvidence,
              disabled: isBusy,
              busy: isBusy
            }
          : undefined
      }
    >
      {displayedRecords.length > 0 ? (
        <div className="tx-progress-list">
          {displayedRecords.map((record, index) => (
            <TxRow key={`${record.label}-${index}`} record={record} />
          ))}
        </div>
      ) : (
        <div className="info-strip">{t.step4.waiting}</div>
      )}

      {shouldStageEscrow && !isStagingComplete && (
        <div className="info-strip">{t.step4.waiting}</div>
      )}

      {!isJobFunded && records.length > 0 && (
        <div className="info-strip">
          {t.step4.confirming}
        </div>
      )}
    </StepShell>
  );
}
