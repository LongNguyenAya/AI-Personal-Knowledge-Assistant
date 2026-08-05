import { tool } from "ai";
import { z } from "zod";
import { db } from "../../db/client";
import { reminders } from "@ai-assistant/db/src/schema";

export function createReminderTool(userId: string) {
  return tool({
    description: "Tạo một reminder (nhắc nhở) mới cho user, có tiêu đề và thời gian hết hạn cụ thể.",
    inputSchema: z.object({
      title: z.string().describe("Tiêu đề ngắn gọn của reminder"),
      content: z.string().optional().describe("Nội dung chi tiết, nếu có"),
      dueAt: z.string().describe("Thời gian hết hạn, định dạng ISO 8601, ví dụ: 2026-08-10T09:00:00Z"),
    }),
    execute: async ({ title, content, dueAt }) => {
      const [created] = await db.insert(reminders).values({
        userId,
        title,
        content,
        dueAt: new Date(dueAt),
        source: "ai_created",
      }).returning();

      return { success: true, reminderId: created.id, title: created.title, dueAt: created.dueAt.toISOString() };
    },
  });
}