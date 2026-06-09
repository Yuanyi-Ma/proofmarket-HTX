import { createInMemoryStore } from "@proofmarket/backend/src/demoStore";
import { createTaskService } from "@proofmarket/backend/src/taskService";

const DEFAULT_QUESTION = "请调研近几年区块链交易执行加速的最新研究进展。";
const DEFAULT_BUDGET = "5 test USDC";

const service = createTaskService(createInMemoryStore());
const task = service.createTask(DEFAULT_QUESTION, DEFAULT_BUDGET);

service.plan(task.id);
service.submitPact(task.id);
service.activatePact(task.id);
service.executeEscrow(task.id);
service.runProvider(task.id, "execution-research-expert");
service.verify(task.id);
service.settle(task.id);

console.log(JSON.stringify(service.getTask(task.id), null, 2));
