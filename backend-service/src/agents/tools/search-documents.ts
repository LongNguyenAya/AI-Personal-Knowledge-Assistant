import { tool } from "ai";
import { z } from "zod";
import type { SearchDocumentsOutput } from "@ai-assistant/shared-types";
import { embedText } from "../../utils/embedding";
import { findRelevantChunks } from "../../db/repositories/chunks";

export function searchDocumentsTool(userId: string) {
  return tool({
    description:
      "Tìm kiếm thông tin trong tài liệu của user để trả lời câu hỏi cần dữ liệu cụ thể. Mỗi kết " +
      "quả kèm fileName — CHỈ được nói tài liệu nào chứa thông tin gì dựa đúng theo fileName trong " +
      "kết quả trả về, không tự suy đoán/gọi tên tài liệu khác.",
    inputSchema: z.object({
      query: z.string().describe("Câu hỏi hoặc từ khóa cần tìm trong tài liệu"),
    }),
    // Kèm documentId/fileName để cả model lẫn FE biết chính xác nguồn của từng đoạn — làm cơ sở
    // hiện "Nguồn" đúng sự thật, không dựa vào lời model tự kể (dễ bịa nhầm tên tài liệu).
    execute: async ({ query }): Promise<SearchDocumentsOutput> => {
      const embedding = await embedText(query);
      // top-3 chung là đủ — tool này để tra 1 sự kiện cụ thể, không cần đa dạng theo tài liệu
      // như retrieval.ts (dùng cho câu hỏi tổng hợp).
      const results = await findRelevantChunks(userId, embedding, { maxPerDocument: 3, totalLimit: 3 });

      return { results: results.map((r) => ({ content: r.content, documentId: r.documentId, fileName: r.fileName })) };
    },
  });
}
