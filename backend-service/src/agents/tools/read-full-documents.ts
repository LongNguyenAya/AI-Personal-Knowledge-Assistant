import { tool } from "ai";
import { z } from "zod";
import { getDocumentChunks } from "../../db/repositories/chunks";

// Không gọi AI bên trong, chỉ trả nội dung thô để agent đang chạy tự tóm tắt/so sánh.
export function readFullDocumentsTool(userId: string) {
  return tool({
    description:
      "Lấy TOÀN BỘ nội dung của 1 hay nhiều tài liệu cụ thể — khác searchDocuments (chỉ tìm vài " +
      "đoạn liên quan nhất tới 1 câu hỏi). Dùng khi user muốn TÓM TẮT 1 tài liệu, hoặc SO SÁNH " +
      "nhiều tài liệu với nhau — cả 2 trường hợp đều cần đọc hết, không phải tìm đoạn liên quan. " +
      "Tool CHỈ trả về nội dung thô, PHẢI tự viết phần tóm tắt/so sánh trong câu trả lời sau đó.",
    inputSchema: z.object({
      documentIds: z
        .array(z.string())
        .describe(
          "id của (các) tài liệu cần đọc toàn bộ — lấy đúng từ danh sách tài liệu trong system " +
            "prompt, không tự bịa. 1 phần tử để tóm tắt, 2 phần tử trở lên để so sánh."
        ),
    }),
    execute: async ({ documentIds }) => {
      const results = await Promise.all(
        documentIds.map(async (documentId) => {
          const docChunks = await getDocumentChunks(userId, documentId);
          return { documentId, rawContent: docChunks.map((c) => c.content).join("\n\n") };
        })
      );

      const missing = results.filter((r) => r.rawContent.length === 0);
      if (missing.length > 0) {
        return {
          success: false as const,
          error: `Không tìm thấy nội dung cho documentId: ${missing.map((m) => m.documentId).join(", ")} — tài liệu không tồn tại hoặc chưa xử lý xong.`,
        };
      }

      // Bọc <document_content>, action prompt đã dặn coi đây là dữ liệu chứ không phải lệnh.
      const documentsOut = results.map((r) => ({
        documentId: r.documentId,
        content: `<document_content>\n${r.rawContent}\n</document_content>`,
      }));

      return { success: true as const, documents: documentsOut };
    },
  });
}
