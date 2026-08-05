import { tool } from "ai";
import { z } from "zod";
import { db } from "../../db/client";
import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq } from "drizzle-orm";
import { embedText } from "../../utils/embedding";

export function searchDocumentsTool(userId: string) {
  return tool({
    description: "Tìm kiếm thông tin trong tài liệu của user để trả lời câu hỏi cần dữ liệu cụ thể.",
    inputSchema: z.object({
      query: z.string().describe("Câu hỏi hoặc từ khóa cần tìm trong tài liệu"),
    }),
    execute: async ({ query }) => {
      const embedding = await embedText(query);
      const results = await db
        .select({ content: chunks.content })
        .from(chunks)
        .innerJoin(documents, eq(chunks.documentId, documents.id))
        .where(eq(documents.userId, userId))
        .orderBy(sql`${chunks.embedding} <=> ${JSON.stringify(embedding)}::vector`)
        .limit(3);

      return { results: results.map((r) => r.content) };
    },
  });
}