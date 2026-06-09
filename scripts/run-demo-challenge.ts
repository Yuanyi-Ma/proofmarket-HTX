import { createInMemoryStore } from "@proofmarket/backend/src/demoStore";
import { createTaskService } from "@proofmarket/backend/src/taskService";

const DEFAULT_QUESTION = "请调研近几年区块链交易执行加速的最新研究进展。";
const DEFAULT_BUDGET = "5 test USDC";

async function main(): Promise<void> {
  const service = createTaskService(createInMemoryStore());
  const task = await service.createTask(DEFAULT_QUESTION, DEFAULT_BUDGET);
  await service.plan(task.id);
  await service.submitPact(task.id);
  await service.activatePact(task.id);
  await service.executeEscrow(task.id);
  await service.runProvider(task.id, "shallow-search-provider");
  await service.verify(task.id);
  await service.winChallenge(task.id);
  await service.refundOrSlash(task.id);
  console.log(JSON.stringify(await service.getTask(task.id), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
