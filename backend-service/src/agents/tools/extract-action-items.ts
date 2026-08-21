import { tool, generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getDocumentChunks } from "../../db/repositories/chunks";

// Chỉ TRẢ VỀ danh sách đề xuất, không tự ghi reminder — bên gọi (action agent, qua prompt) phải
// trình bày lại cho user xác nhận rồi mới gọi createReminder (tool cũ) cho từng mục được duyệt.
// Tách riêng khỏi createReminder vì đây là suy luận từ văn bản tự do (dễ đọc nhầm/đoán sai ngày),
// khác hẳn trường hợp user tự đọc chính xác tiêu đề + giờ muốn tạo.
export function extractActionItemsTool(userId: string) {
  return tool({
    description:
      "Quét TOÀN BỘ nội dung 1 tài liệu để tìm việc cần làm/deadline được đề cập rõ ràng — dùng khi " +
      "user muốn AI tự tìm việc cần làm trong 1 tài liệu cụ thể (vd 'xem tài liệu X và tạo nhắc nhở " +
      "nếu có'). Chỉ trả về ĐỀ XUẤT, không tự tạo reminder.",
    inputSchema: z.object({
      documentId: z
        .string()
        .describe("id của tài liệu cần quét — lấy đúng từ danh sách tài liệu đã cho trong system prompt, không tự bịa."),
    }),
    execute: async ({ documentId }) => {
      const docChunks = await getDocumentChunks(userId, documentId);
      if (docChunks.length === 0) {
        return { success: false as const, error: "Không tìm thấy tài liệu này, hoặc tài liệu chưa xử lý xong (chưa có chunk nào)." };
      }
      const fullText = docChunks.map((c) => c.content).join("\n\n");

      const { object } = await generateObject({
        model: google("gemini-flash-lite-latest"),
        schema: z.object({
          items: z.array(
            z.object({
              title: z.string().describe("Tên việc cần làm, ngắn gọn"),
              // 'YYYY-MM-DD' hay 'YYYY-MM-DDTHH:mm' tuỳ tài liệu có nêu giờ hay không — KHÔNG có hậu
              // tố Z/timezone, vì đây là giờ Việt Nam theo nghĩa đen đọc từ tài liệu, để nguyên cho
              // action agent tự quy đổi UTC bằng đúng quy tắc đã có trong prompt (tránh làm 2 nơi
              // quy đổi giờ khác nhau, dễ lệch nhau).
              dueAt: z
                .string()
                .nullable()
                .describe(
                  "Hạn chót — CHỈ điền khi tài liệu nói RÕ ngày cụ thể. Định dạng 'YYYY-MM-DD' nếu tài " +
                    "liệu chỉ nêu ngày (không nói giờ); định dạng 'YYYY-MM-DDTHH:mm' (giờ Việt Nam, KHÔNG " +
                    "thêm hậu tố Z) nếu tài liệu CÓ nêu rõ giờ cụ thể (vd 'họp lúc 14h ngày 25/08/2026' → " +
                    "'2026-08-25T14:00'). null nếu tài liệu chỉ nói mơ hồ (vd 'sớm', 'trong tuần này'), " +
                    "không tự suy đoán ngày hay giờ."
                ),
              sourceQuote: z.string().describe("Trích nguyên văn câu trong tài liệu làm căn cứ cho việc này"),
            })
          ),
        }),
        prompt:
          `Đọc tài liệu bên dưới, tìm các việc cần làm/deadline được đề cập. Nếu tài liệu không có ` +
          `việc cần làm nào, trả về items rỗng. TUYỆT ĐỐI không bịa thêm việc không có trong tài liệu.\n\n` +
          `Tài liệu:\n${fullText}`,
        telemetry: { functionId: "extract-action-items" },
      });

      return { success: true as const, items: object.items };
    },
  });
}
