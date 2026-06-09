"use client";

import { useEffect, useState } from "react";
import { defaultQuestion } from "@proofmarket/shared/src/fixtures";
import type { ProviderId, Task } from "@proofmarket/shared/src/types";
import { AuditLog } from "../components/AuditLog";
import { ChallengePanel } from "../components/ChallengePanel";
import { EvidencePanel } from "../components/EvidencePanel";
import { ExecutionTimeline } from "../components/ExecutionTimeline";
import { FinalAnswer } from "../components/FinalAnswer";
import { ModeBadge } from "../components/ModeBadge";
import { PactReview } from "../components/PactReview";
import { ProcurementPlan } from "../components/ProcurementPlan";
import { ProviderMarket } from "../components/ProviderMarket";
import { TaskEntry } from "../components/TaskEntry";

type ActionName =
  | "plan"
  | "pact"
  | "pact-status"
  | "execute"
  | "provider"
  | "verify"
  | "settle"
  | "denial-demo"
  | "challenge-win"
  | "refund-or-slash";

const polledActions: ReadonlySet<string> = new Set(["execute", "provider", "settle"]);

async function readTaskResponse(response: Response): Promise<Task> {
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : text || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as Task;
}

export default function Page() {
  const [question, setQuestion] = useState(defaultQuestion);
  const [budget, setBudget] = useState("5 test USDC");
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const isBusy = busyAction !== null;
  const taskId = task?.id ?? null;

  // While a slow on-chain action runs, poll the task so incrementally saved
  // txRecords show up. The cleanup runs when busyAction changes (the POST
  // response stays the final word) and on unmount.
  useEffect(() => {
    if (!taskId || !busyAction || !polledActions.has(busyAction)) return;

    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) return;
        const polled = (await response.json()) as Task;
        if (!cancelled) setTask(polled);
      } catch {
        // Polling is best-effort; the POST in flight reports real errors.
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [busyAction, taskId]);

  async function createTask() {
    if (isBusy) return;

    setError(null);
    setBusyAction("create");

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, budget })
      });
      setTask(await readTaskResponse(response));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to create task."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(action: ActionName, body: unknown = {}) {
    if (isBusy || !task) return;

    setError(null);
    setBusyAction(action);

    try {
      const response = await fetch(`/api/tasks/${task.id}/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      setTask(await readTaskResponse(response));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Unable to run ${action}.`
      );
    } finally {
      setBusyAction(null);
    }
  }

  function runProvider(providerId: ProviderId) {
    return runAction("provider", { providerId });
  }

  return (
    <main className="app-shell" aria-busy={busyAction ? "true" : "false"}>
      <div className="page-header">
        <h1>ProofMarket task workflow</h1>
        <p>Bounded procurement, Cobo policy, evidence, challenge, and audit.</p>
        <ModeBadge task={task} />
      </div>
      <div className="workflow-grid">
        <section className="main-stack" aria-label="ProofMarket workflow">
          {error ? (
            <div className="error-strip" role="alert">
              Route error: {error}
            </div>
          ) : null}

          <TaskEntry
            task={task}
            question={question}
            budget={budget}
            onQuestionChange={setQuestion}
            onBudgetChange={setBudget}
            onCreate={createTask}
            isBusy={isBusy}
          />
          <ProcurementPlan
            task={task}
            onGenerate={() => runAction("plan")}
            isBusy={isBusy}
          />
          <ProviderMarket
            task={task}
            onRunExpert={() => runProvider("execution-research-expert")}
            onRunShallow={() => runProvider("shallow-search-provider")}
            isBusy={isBusy}
          />
          <PactReview
            task={task}
            onSubmit={() => runAction("pact")}
            onFund={() => runAction("execute")}
            onTriggerDenial={() => runAction("denial-demo")}
            onCheckApproval={() => runAction("pact-status")}
            isBusy={isBusy}
          />
          <EvidencePanel
            task={task}
            onVerify={() => runAction("verify")}
            isBusy={isBusy}
          />
          <FinalAnswer
            task={task}
            onSettle={() => runAction("settle")}
            isBusy={isBusy}
          />
          <ChallengePanel
            task={task}
            onWinChallenge={() => runAction("challenge-win")}
            onRefundOrSlash={() => runAction("refund-or-slash")}
            isBusy={isBusy}
          />
        </section>

        <aside className="side-stack" aria-label="Timeline and audit">
          <ExecutionTimeline task={task} />
          <AuditLog task={task} />
        </aside>
      </div>
    </main>
  );
}
