import { tool } from "ai";
import { z } from "zod";
import type { SearchDocumentsOutput } from "@ai-assistant/shared-types";
import { embedText } from "../../utils/embedding";
import { findRelevantChunks } from "../../db/repositories/chunks";
import { hasAnyProcessedDocuments } from "../../db/repositories/documents";

export function searchDocumentsTool(userId: string) {
  return tool({
    description:
      "Tìm kiếm thông tin trong tài liệu của user để trả lời câu hỏi cần dữ liệu cụ thể. Mỗi kết " +
      "quả kèm fileName. CHỈ được nói tài liệu nào chứa thông tin gì dựa đúng theo fileName trong " +
      "kết quả trả về, không tự suy đoán/gọi tên tài liệu khác. Nếu results rỗng, xem thêm " +
      "hasAnyDocuments: false nghĩa là user CHƯA upload/xử lý xong tài liệu nào, nói rõ điều đó " +
      "thay vì nói 'không tìm thấy thông tin liên quan' (2 tình huống khác hẳn nhau).",
    inputSchema: z.object({
      query: z.string().describe("Câu hỏi hoặc từ khóa cần tìm trong tài liệu"),
    }),
    // Includes documentId/fileName so "Source" reflects the truth, instead of relying on the model's own claim (prone to making up a name).
    execute: async ({ query }): Promise<SearchDocumentsOutput> => {
      const embedding = await embedText(query);
      // A shared top-3 is enough, looking up 1 specific fact doesn't need per-document diversity like retrieval.ts.
      const results = await findRelevantChunks(userId, embedding, { maxPerDocument: 3, totalLimit: 3 });

      // Wrapped in <document_content>, same reason as read-full-documents.ts.
      const output: SearchDocumentsOutput = {
        results: results.map((r) => ({
          content: `<document_content>\n${r.content}\n</document_content>`,
          documentId: r.documentId,
          fileName: r.fileName,
        })),
      };

      // Only worth the extra query when there's actually nothing to explain, same pattern as create-chart.ts's emptyReason.
      if (results.length === 0) {
        output.hasAnyDocuments = await hasAnyProcessedDocuments(userId);
      }

      return output;
    },
  });
}
