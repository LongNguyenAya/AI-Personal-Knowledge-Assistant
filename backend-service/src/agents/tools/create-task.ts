import { tool } from "ai";
import { z } from "zod";
import { createTask } from "../../db/repositories/tasks";

export function createTaskTool(userId: string) {
  return tool({
    description: "Tạo một task (công việc cần làm) mới cho user.",
    inputSchema: z.object({
      title: z.string().describe("Tiêu đề ngắn gọn của task"),
    }),
    execute: async ({ title }) => {
      const created = await createTask(userId, title);

      return { success: true, taskId: created.id, title: created.title };
    },
  });
}
