import type { Task } from "@proofmarket/shared/src/types";

export type InMemoryStore = {
  getTask(id: string): Task;
  saveTask(task: Task): Task;
  listTasks(): Task[];
};

export function createInMemoryStore(): InMemoryStore {
  const tasks = new Map<string, Task>();

  return {
    getTask(id: string): Task {
      const task = tasks.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }
      return task;
    },
    saveTask(task: Task): Task {
      tasks.set(task.id, task);
      return task;
    },
    listTasks(): Task[] {
      return Array.from(tasks.values());
    }
  };
}
