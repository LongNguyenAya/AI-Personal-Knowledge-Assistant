import { tool } from "ai";
import { z } from "zod";
import { listTasks } from "../../db/repositories/tasks";

export function listTasksTool(userId: string) {
  return tool({
    description:
      "Liệt kê các task cụ thể (kèm tiêu đề) của user, có thể lọc theo trạng thái hoàn thành và/hoặc khoảng thời gian. Dùng khi user muốn xem TÊN/NỘI DUNG task cụ thể — không dùng cho câu hỏi về số lượng/thống kê/xu hướng (những câu đó dùng createChart).",
    inputSchema: z.object({
      onlyDone: z
        .boolean()
        .optional()
        .describe("true để chỉ lấy task ĐÃ hoàn thành, false để chỉ lấy task CHƯA hoàn thành, bỏ trống để lấy tất cả."),
      from: z
        .string()
        .optional()
        .describe(
          "Mốc bắt đầu khoảng thời gian cần lọc, ISO 8601 (vd user hỏi 'trong tháng 7' → đầu tháng 7 theo giờ VN, quy đổi sang UTC). Bỏ trống nếu user không giới hạn thời gian. Nếu onlyDone=true, lọc theo thời điểm HOÀN THÀNH; ngược lại lọc theo thời điểm TẠO task."
        ),
      to: z.string().optional().describe("Mốc kết thúc khoảng thời gian, ISO 8601, cùng quy tắc với from."),
    }),
    execute: async ({ onlyDone, from, to }) => {
      const parsedFrom = from ? new Date(from) : undefined;
      const parsedTo = to ? new Date(to) : undefined;
      if ((from && Number.isNaN(parsedFrom?.getTime())) || (to && Number.isNaN(parsedTo?.getTime()))) {
        return { error: `Khoảng thời gian "${from} - ${to}" không hợp lệ (không đúng định dạng ISO 8601).` };
      }

      const results = await listTasks(userId, { onlyDone, from: parsedFrom, to: parsedTo });
      // Serialize Date thành ISO string, AI SDK không chấp nhận Date thô, để lọt sẽ sập cả request.
      const tasks = results.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }));
      return { tasks, count: tasks.length };
    },
  });
}
