import { tool } from "ai";
import { z } from "zod";
import { createReminder } from "../../db/repositories/reminders";
import { findTaskByTitle } from "../../db/repositories/tasks";

export function createReminderTool(userId: string) {
  return tool({
    description: "Tạo một reminder (nhắc nhở) mới cho user, có tiêu đề và thời gian hết hạn cụ thể.",
    inputSchema: z.object({
      title: z.string().describe("Tiêu đề ngắn gọn của reminder"),
      content: z.string().optional().describe("Nội dung chi tiết, nếu có"),
      dueAt: z.string().describe("Thời gian hết hạn, định dạng ISO 8601, ví dụ: 2026-08-10T09:00:00Z"),
      taskTitles: z
        .array(z.string())
        .optional()
        .describe(
          "Tên/tiêu đề CHÍNH XÁC của (các) task đã có sẵn mà reminder này nhắc nhở, nếu user có nhắc tới. Có thể liệt kê nhiều task nếu 1 reminder nhắc nhiều việc cùng lúc. Chỉ điền khi user nói rõ tên task, KHÔNG tự suy đoán."
        ),
    }),
    execute: async ({ title, content, dueAt, taskTitles }) => {
      // dueAt do model tự sinh, validate trước để tránh ném lỗi thô khi sai định dạng.
      const parsedDueAt = new Date(dueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        return { success: false, error: `Thời gian "${dueAt}" không hợp lệ (không đúng định dạng ISO 8601). Reminder chưa được tạo.` };
      }

      // Dừng hẳn nếu có 1 task không tìm thấy, tránh tạo reminder thiếu liên kết mà tưởng đã gắn.
      const resolvedTaskIds: string[] = [];
      for (const t of taskTitles ?? []) {
        const task = await findTaskByTitle(userId, t);
        if (!task) {
          return { success: false, error: `Không tìm thấy task nào tên "${t}". Reminder chưa được tạo.` };
        }
        resolvedTaskIds.push(task.id);
      }

      const created = await createReminder(userId, {
        title,
        content,
        dueAt: parsedDueAt,
        source: "ai_created",
        taskIds: resolvedTaskIds,
      });

      return {
        success: true,
        reminderId: created.id,
        title: created.title,
        dueAt: created.dueAt.toISOString(),
        linkedTaskTitles: taskTitles ?? [],
        // Báo lại nếu có task bị chuyển từ reminder cũ sang (1 task chỉ thuộc 1 reminder/thời điểm).
        note:
          created.relinkedTaskIds.length > 0
            ? "Một số task đã được chuyển liên kết từ reminder cũ sang reminder mới này."
            : undefined,
      };
    },
  });
}
