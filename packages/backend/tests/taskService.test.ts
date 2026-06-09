import { describe, expect, it } from "vitest";
import { createInMemoryStore } from "../src/demoStore";
import { createTaskService } from "../src/taskService";

const researchQuestion =
  "请调研近几年区块链交易执行加速的最新研究进展。";

describe("task service orchestration", () => {
  it("runs the happy path through settlement", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPact(task.id);
    await service.activatePact(task.id);
    await service.executeEscrow(task.id);
    await service.runProvider(task.id, "execution-research-expert");
    await service.verify(task.id);
    await service.settle(task.id);

    const finalTask = await service.getTask(task.id);
    expect(finalTask.status).toBe("Settled");
    expect(finalTask.pact).toMatchObject({
      allowedTargets: [
        "ProofMarketEscrow",
        "MockUSDC",
        "ProofMarketChallengeManager"
      ],
      allowedFunctions: [
        "createJob",
        "fund",
        "submit",
        "complete",
        "reject",
        "approve"
      ],
      denyRules: [
        "direct transfer",
        "non-whitelisted target",
        "amount above cap",
        "expired pact"
      ]
    });
    expect(
      finalTask.audit.some(
        (event) => event.source === "cobo" && event.result === "success"
      )
    ).toBe(true);
    expect(
      finalTask.audit.some(
        (event) => event.source === "verifier" && event.result === "success"
      )
    ).toBe(true);
  });

  it("records a Cobo denial without creating a job or tx hash", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPact(task.id);
    await service.activatePact(task.id);
    await service.triggerDenial(task.id);

    const denied = await service.getTask(task.id);
    expect(denied.status).toBe("DeniedByCobo");
    expect(denied.jobId).toBeNull();
    expect(denied.audit.at(-1)?.result).toBe("denied");
    expect(denied.audit.at(-1)?.txHash).toBeNull();
    expect(denied.audit.at(-1)?.message).toContain(
      "Direct transfer rejected because target is not whitelisted"
    );
    expect(denied.audit.at(-1)?.message).toContain(
      "target=0xDeniedDirectTransfer"
    );
    expect(denied.audit.at(-1)?.message).toContain("amount=10 SETH");
    expect(denied.audit.at(-1)?.message).toContain("moved funds=0 test USDC");
    expect(denied.audit.at(-1)?.message).toContain("no escrow job created");
  });

  it("recovers from Cobo denial by executing escrow later", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPact(task.id);
    await service.activatePact(task.id);
    await service.triggerDenial(task.id);
    await service.executeEscrow(task.id);

    expect((await service.getTask(task.id)).status).toBe("JobFunded");
  });

  it("moves provider faults through challenge and refund or slash", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPact(task.id);
    await service.activatePact(task.id);
    await service.executeEscrow(task.id);
    await service.runProvider(task.id, "shallow-search-provider");
    await service.verify(task.id);

    expect((await service.getTask(task.id)).status).toBe("Challenged");
    await service.winChallenge(task.id);
    expect((await service.getTask(task.id)).status).toBe("ChallengeWon");
    await service.refundOrSlash(task.id);
    expect((await service.getTask(task.id)).status).toBe("RefundedOrSlashed");
    expect(
      (await service.getTask(task.id)).audit.some(
        (event) => event.type === "refund_or_slash"
      )
    ).toBe(true);
  });

  it("rejects verification before provider delivery", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await expect(service.verify(task.id)).rejects.toThrow(
      "Cannot verify before provider delivery"
    );
  });
});
