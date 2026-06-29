import { describe, expect, it } from "vitest";
import { createInMemoryStore } from "../src/demoStore";
import { createTaskService } from "../src/taskService";

const researchQuestion =
  "请调研近几年区块链交易执行加速的最新研究进展。";
const repeatedHexHash = /^0x([0-9a-f])\1{63}$/i;

describe("task service orchestration", () => {
  it("runs the happy path through settlement", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPolicy(task.id);
    await service.activatePolicy(task.id);
    await service.executeEscrow(task.id, "execution-research-expert");
    await service.runProvider(task.id, "execution-research-expert");
    await service.verify(task.id);
    await service.settle(task.id);

    const finalTask = await service.getTask(task.id);
    expect(finalTask.status).toBe("Settled");
    expect(finalTask.policy).toMatchObject({
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
        "expired policy"
      ]
    });
    expect(
      finalTask.audit.some(
        (event) => event.source === "policy-signer" && event.result === "success"
      )
    ).toBe(true);
    expect(
      finalTask.audit.some(
        (event) => event.source === "verifier" && event.result === "success"
      )
    ).toBe(true);
  });

  it("records a Policy Signer denial without creating a job or tx hash", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPolicy(task.id);
    await service.activatePolicy(task.id);
    await service.triggerDenial(task.id);

    const denied = await service.getTask(task.id);
    expect(denied.status).toBe("DeniedByPolicy");
    expect(denied.jobId).toBeNull();
    expect(denied.audit.at(-1)?.result).toBe("denied");
    expect(denied.audit.at(-1)?.txHash).toBeNull();
    expect(denied.audit.at(-1)?.message).toContain(
      "direct transfer rejected because the target is outside the allowlist"
    );
    expect(denied.audit.at(-1)?.message).toContain(
      "attemptedTarget=0xDeniedDirectTransfer"
    );
    expect(denied.audit.at(-1)?.message).toContain("amount=10 SETH");
    expect(denied.audit.at(-1)?.message).toContain("fundsMoved=0 test USDC");
    expect(denied.audit.at(-1)?.message).toContain("no escrow order was created");
  });

  it("fixtures escrow execution with four confirmed procurement tx records", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPolicy(task.id);
    await service.activatePolicy(task.id);
    const funded = await service.executeEscrow(task.id);

    expect(funded.status).toBe("JobFunded");
    expect(funded.txRecords.map((record) => record.label)).toEqual([
      "approve",
      "createJob",
      "setBudget",
      "fund"
    ]);
    expect(funded.txRecords.every((record) => record.status === "confirmed")).toBe(true);
    expect(funded.txRecords.every((record) => /^0x[0-9a-f]{64}$/.test(record.txHash))).toBe(true);
    expect(funded.txRecords.some((record) => repeatedHexHash.test(record.txHash))).toBe(false);
    expect(funded.txRecords.map((record) => record.policySignerRequestId)).toEqual([
      `fixture-${task.id}-approve`,
      `fixture-${task.id}-createJob`,
      `fixture-${task.id}-setBudget`,
      `fixture-${task.id}-fund`
    ]);
  });

  it("recovers from Policy Signer denial by executing escrow later", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPolicy(task.id);
    await service.activatePolicy(task.id);
    await service.triggerDenial(task.id);
    await service.executeEscrow(task.id, "shallow-search-provider");

    expect((await service.getTask(task.id)).status).toBe("JobFunded");
  });

  it("moves provider faults through challenge and refund or slash", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPolicy(task.id);
    await service.activatePolicy(task.id);
    await service.executeEscrow(task.id, "shallow-search-provider");
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

  it("walks the explicit challenge path end to end: openChallenge → vote → refund/slash", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await service.plan(task.id);
    await service.submitPolicy(task.id);
    await service.activatePolicy(task.id);
    await service.executeEscrow(task.id, "shallow-search-provider");
    await service.runProvider(task.id, "shallow-search-provider");

    // 发起：Delivered → Challenged, preset CoverageMiss challenge recorded
    const challenged = await service.openChallenge(task.id);
    expect(challenged.status).toBe("Challenged");
    expect(challenged.challenge?.type).toBe("CoverageMiss");
    expect(challenged.challenge?.counterEvidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    const openEvent = challenged.audit.find((event) => event.type === "challenge_opened");
    expect(openEvent?.source).toBe("user");
    expect(openEvent?.message).toContain("User opened a CoverageMiss challenge");
    expect(openEvent?.message).toContain("CoverageMiss");

    // 应辩：preset defense recorded alongside the challenge
    expect(challenged.challenge?.statement).toContain("Block-STM");
    expect(challenged.challenge?.defense?.defenseHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(challenged.audit.some((event) => event.type === "defense_submitted")).toBe(true);

    // 审判：preset jury votes (2:1 ProviderFault) recorded on the challenge
    const won = await service.winChallenge(task.id);
    expect(won.status).toBe("ChallengeWon");
    expect(won.challenge?.votes).toHaveLength(3);
    expect(won.challenge?.votes?.map((v) => v.vote)).toEqual([
      "ProviderFault",
      "ProviderFault",
      "ProviderNotFault"
    ]);
    expect(won.challenge?.votes?.every((v) => /^0x[0-9a-f]{64}$/.test(v.reasonHash))).toBe(true);
    expect(won.audit.filter((event) => event.type === "jury_vote")).toHaveLength(3);
    const voteEvent = won.audit.find((event) => event.type === "challenge_won");
    expect(voteEvent?.message).toContain("ProviderFault");
    expect(voteEvent?.message).toContain("2:1");

    // 资金动作：slash provider stake / refund buyer / return deposit + fee
    const refunded = await service.refundOrSlash(task.id);
    expect(refunded.status).toBe("RefundedOrSlashed");
    const fundEvent = refunded.audit.find((event) => event.type === "refund_or_slash");
    expect(fundEvent?.message).toContain("Provider bond was slashed");
    expect(fundEvent?.message).toContain("escrowed funds return to the buyer");
    expect(fundEvent?.message).toContain("jury fee");
  });

  it("rejects openChallenge before evidence delivery", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");
    await expect(service.openChallenge(task.id)).rejects.toThrow(/open a challenge/i);
  });

  it("rejects verification before provider delivery", async () => {
    const service = createTaskService(createInMemoryStore());
    const task = await service.createTask(researchQuestion, "5 test USDC");

    await expect(service.verify(task.id)).rejects.toThrow(
      "Cannot verify before provider delivery"
    );
  });
});
