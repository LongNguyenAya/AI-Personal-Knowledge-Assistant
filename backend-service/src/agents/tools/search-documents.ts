import { tool } from "ai";
import { z } from "zod";
import { embedText } from "../../utils/embedding";
import { findRelevantChunks } from "../../db/repositories/chunks";

export function searchDocumentsTool(userId: string) {
  return tool({
    description: "Tìm kiếm thông tin trong tài liệu của user để trả lời câu hỏi cần dữ liệu cụ thể.",
    inputSchema: z.object({
      query: z.string().describe("Câu hỏi hoặc từ khóa cần tìm trong tài liệu"),
    }),
    execute: async ({ query }) => {
      const embedding = await embedText(query);
      // top-3 chung là đủ — tool này để tra 1 sự kiện cụ thể, không cần đa dạng theo tài liệu
      // như retrieval.ts (dùng cho câu hỏi tổng hợp).
      const results = await findRelevantChunks(userId, embedding, { maxPerDocument: 3, totalLimit: 3 });

      return { results: results.map((r) => r.content) };
    },
  });
}
