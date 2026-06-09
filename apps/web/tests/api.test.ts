import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getTaskService } from "../lib/api";
import { POST as createTask } from "../app/api/tasks/route";
import { GET as readTask } from "../app/api/tasks/[taskId]/route";
import { POST as planTask } from "../app/api/tasks/[taskId]/plan/route";
import { POST as submitPact } from "../app/api/tasks/[taskId]/pact/route";
import { POST as executeEscrow } from "../app/api/tasks/[taskId]/execute/route";
import { POST as runProvider } from "../app/api/tasks/[taskId]/provider/route";
import { POST as verifyTask } from "../app/api/tasks/[taskId]/verify/route";
import { POST as settleTask } from "../app/api/tasks/[taskId]/settle/route";
import type { Task } from "@proofmarket/shared/src/types";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

function contextFor(taskId: string): RouteContext {
  return {
    params: Promise.resolve({ taskId })
  };
}

async function taskFrom(response: Response): Promise<Task> {
  return (await response.json()) as Task;
}

async function jsonFrom<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function taskIdNumber(taskId: string): number {
  return Number(taskId.replace("task_", ""));
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("ProofMarket API routes", () => {
  it("reuses one task service singleton across calls", async () => {
    const service = getTaskService();
    expect(getTaskService()).toBe(service);

    const first = await service.createTask("singleton one", "1 test USDC");
    const second = await service.createTask("singleton two", "1 test USDC");

    expect(taskIdNumber(second.id)).toBe(taskIdNumber(first.id) + 1);
  });

  it("runs the happy route flow through settlement", async () => {
    const created = await taskFrom(await createTask(jsonRequest({})));
    const taskContext = contextFor(created.id);

    expect(created.userQuestion).toBe("请调研近几年区块链交易执行加速的最新研究进展。");
    expect(created.budgetLimit).toBe("5 test USDC");
    expect(created.status).toBe("Created");

    const planned = await taskFrom(await planTask(jsonRequest({}), taskContext));
    expect(planned.status).toBe("Planned");
    expect(planned.selectedProviderIds).toHaveLength(3);

    const activePact = await taskFrom(await submitPact(jsonRequest({}), taskContext));
    expect(activePact.status).toBe("PactActive");
    expect(activePact.pact?.status).toBe("active");

    const funded = await taskFrom(await executeEscrow(jsonRequest({}), taskContext));
    expect(funded.status).toBe("JobFunded");

    const delivered = await taskFrom(await runProvider(jsonRequest({}), taskContext));
    expect(delivered.status).toBe("Delivered");
    expect(delivered.providerPackage?.providerId).toBe("execution-research-expert");

    const verified = await taskFrom(await verifyTask(jsonRequest({}), taskContext));
    expect(verified.status).toBe("Verified");

    const settled = await taskFrom(await settleTask(jsonRequest({}), taskContext));
    expect(settled.status).toBe("Settled");

    const fetched = await taskFrom(await readTask(new Request("http://localhost/api/tasks"), taskContext));
    expect(fetched.status).toBe("Settled");
    expect(fetched.audit.map((event) => [event.type, event.result])).toEqual([
      ["task_created", "success"],
      ["procurement_plan_created", "success"],
      ["pact_submitted", "success"],
      ["pact_activated", "success"],
      ["escrow_executed", "success"],
      ["provider_package_delivered", "success"],
      ["verification_passed", "success"],
      ["settled", "success"]
    ]);
  });

  it("rejects invalid provider IDs without running provider delivery", async () => {
    const created = await taskFrom(await createTask(jsonRequest({})));
    const taskContext = contextFor(created.id);

    await planTask(jsonRequest({}), taskContext);
    await submitPact(jsonRequest({}), taskContext);
    const funded = await taskFrom(await executeEscrow(jsonRequest({}), taskContext));
    expect(funded.status).toBe("JobFunded");

    const response = await runProvider(
      jsonRequest({ providerId: "not-a-provider" }),
      taskContext
    );

    expect(response.status).toBe(400);
    expect(await jsonFrom(response)).toEqual({
      error: "Invalid providerId",
      validProviderIds: [
        "execution-research-expert",
        "shallow-search-provider",
        "general-web-summary"
      ]
    });

    const fetched = await taskFrom(await readTask(new Request("http://localhost/api/tasks"), taskContext));
    expect(fetched.status).toBe("JobFunded");
    expect(fetched.providerPackage).toBeNull();
  });

  it("rejects explicit falsy provider IDs without running provider delivery", async () => {
    for (const providerId of ["", null]) {
      const created = await taskFrom(await createTask(jsonRequest({})));
      const taskContext = contextFor(created.id);

      await planTask(jsonRequest({}), taskContext);
      await submitPact(jsonRequest({}), taskContext);
      const funded = await taskFrom(await executeEscrow(jsonRequest({}), taskContext));
      expect(funded.status).toBe("JobFunded");

      const response = await runProvider(
        jsonRequest({ providerId }),
        taskContext
      );

      expect(response.status).toBe(400);

      const fetched = await taskFrom(await readTask(new Request("http://localhost/api/tasks"), taskContext));
      expect(fetched.status).toBe("JobFunded");
      expect(fetched.providerPackage).toBeNull();
    }
  });
});
