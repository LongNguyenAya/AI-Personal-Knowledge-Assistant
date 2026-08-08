import { tool } from "ai";
import { z } from "zod";
import { listTasks } from "../../db/repositories/tasks";

export function listTasksTool(userId: string) {
  return tool({
    description: "Liệt kê các task hiện tại của user.",
    inputSchema: z.object({
      onlyPending: z.boolean().optional().describe("true để chỉ lấy task chưa hoàn thành"),
    }),
    execute: async ({ onlyPending }) => {
      const results = await listTasks(userId, onlyPending);

      return { tasks: results };
    },
  });
}
