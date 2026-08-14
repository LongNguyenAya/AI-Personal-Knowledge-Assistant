import { tool } from "ai";
import { z } from "zod";
import { insertPendingNote } from "../../db/repositories/knowledge";

export function proposeKnowledgeNoteTool(userId: string) {
  return tool({
    description:
      "Đề xuất 1 ghi chú kiến thức để agent ghi nhớ lâu dài cho các cuộc hội thoại SAU (không chỉ " +
      "lượt này, và cho MỌI user chứ không riêng ai). CHỈ gọi khi user CHỦ ĐỘNG yêu cầu ghi nhớ " +
      "(vd 'từ giờ hãy nhớ...', sửa sai rõ ràng áp dụng được về sau) — TUYỆT ĐỐI KHÔNG tự ý gọi sau " +
      "mỗi cuộc hội thoại để 'rút kinh nghiệm', không đoán ý user. Ghi chú CHƯA có hiệu lực ngay, " +
      "cần admin duyệt trước khi được dùng để trả lời các câu hỏi sau này. Nội dung PHẢI là bài " +
      "học/quy tắc CHUNG áp dụng cho mọi user — TUYỆT ĐỐI không chứa tên, email, hay nội dung " +
      "task/reminder riêng của user hiện tại, vì ghi chú sẽ hiển thị cho MỌI user khác sau khi duyệt.",
    inputSchema: z.object({
      path: z.string().describe("Nhãn phân loại ngắn kiểu đường dẫn, vd 'learnings/task-tool-routing'. Không cần unique."),
      title: z.string().max(200).describe("Tiêu đề ngắn gọn của ghi chú."),
      content: z.string().max(2000).describe("Nội dung đầy đủ, tối đa 2000 ký tự, KHÔNG chứa thông tin riêng của user."),
    }),
    execute: async ({ path, title, content }) => {
      const created = await insertPendingNote({ path, title, content, proposedBy: userId });
      return { success: true, id: created.id, status: created.status };
    },
  });
}
