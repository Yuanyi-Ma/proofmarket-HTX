import "server-only";
import { createInMemoryStore } from "@proofmarket/backend/src/demoStore";
import { createTaskService } from "@proofmarket/backend/src/taskService";

type TaskService = ReturnType<typeof createTaskService>;

const globalForProofMarket = globalThis as typeof globalThis & {
  proofMarketService?: TaskService;
};

export function getTaskService(): TaskService {
  if (!globalForProofMarket.proofMarketService) {
    globalForProofMarket.proofMarketService = createTaskService(createInMemoryStore());
  }

  return globalForProofMarket.proofMarketService;
}
