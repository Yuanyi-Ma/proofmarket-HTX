import { describe, expect, it } from "vitest";
import { createInMemoryStore } from "../src/demoStore";
import { createTaskService } from "../src/taskService";

const researchQuestion =
  "请调研近几年区块链交易执行加速的最新研究进展。";

describe("task service orchestration", () => {
  it("runs the happy path through settlement", () => {
    const service = createTaskService(createInMemoryStore());
    const task = service.createTask(researchQuestion, "5 test USDC");

    service.plan(task.id);
    service.submitPact(task.id);
    service.activatePact(task.id);
    service.executeEscrow(task.id);
    service.runProvider(task.id, "execution-research-expert");
    service.verify(task.id);
    service.settle(task.id);

    const finalTask = service.getTask(task.id);
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

  it("records a Cobo denial without creating a job or tx hash", () => {
    const service = createTaskService(createInMemoryStore());
    const task = service.createTask(researchQuestion, "5 test USDC");

    service.plan(task.id);
    service.submitPact(task.id);
    service.activatePact(task.id);
    service.triggerDenial(task.id);

    const denied = service.getTask(task.id);
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

  it("recovers from Cobo denial by executing escrow later", () => {
    const service = createTaskService(createInMemoryStore());
    const task = service.createTask(researchQuestion, "5 test USDC");

    service.plan(task.id);
    service.submitPact(task.id);
    service.activatePact(task.id);
    service.triggerDenial(task.id);
    service.executeEscrow(task.id);

    expect(service.getTask(task.id).status).toBe("JobFunded");
  });

  it("moves provider faults through challenge and refund or slash", () => {
    const service = createTaskService(createInMemoryStore());
    const task = service.createTask(researchQuestion, "5 test USDC");

    service.plan(task.id);
    service.submitPact(task.id);
    service.activatePact(task.id);
    service.executeEscrow(task.id);
    service.runProvider(task.id, "shallow-search-provider");
    service.verify(task.id);

    expect(service.getTask(task.id).status).toBe("Challenged");
    service.winChallenge(task.id);
    expect(service.getTask(task.id).status).toBe("ChallengeWon");
    service.refundOrSlash(task.id);
    expect(service.getTask(task.id).status).toBe("RefundedOrSlashed");
    expect(
      service
        .getTask(task.id)
        .audit.some((event) => event.type === "refund_or_slash")
    ).toBe(true);
  });

  it("rejects verification before provider delivery", () => {
    const service = createTaskService(createInMemoryStore());
    const task = service.createTask(researchQuestion, "5 test USDC");

    expect(() => service.verify(task.id)).toThrow(
      "Cannot verify before provider delivery"
    );
  });
});
