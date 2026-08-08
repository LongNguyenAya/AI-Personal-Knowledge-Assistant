import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq } from "drizzle-orm";
import { withUserContext } from "../context";

type NewChunk = { content: string; chunkIndex: number; embedding: number[] };

// Ghi tất cả chunk của 1 tài liệu trong CÙNG 1 transaction — trước đây mỗi chunk có
// transaction riêng (mỗi query 1 round-trip), gộp lại vừa đúng ngữ nghĩa hơn (1 tài liệu
// nên "ghi hết hoặc không ghi gì", không dừng nửa chừng để lại vài chunk mồ côi) vừa ít
// round-trip DB hơn.
export async function insertChunks(userId: string, documentId: string, items: NewChunk[]) {
  return withUserContext(userId, async (tx) => {
    for (const item of items) {
      await tx.insert(chunks).values({ documentId, ...item });
    }
  });
}

export async function findRelevantChunks(userId: string, embedding: number[], limit: number) {
  return withUserContext(userId, (tx) =>
    tx
      .select({
        content: chunks.content,
        documentId: documents.id,
        fileName: documents.fileName,
        distance: sql<number>`${chunks.embedding} <=> ${JSON.stringify(embedding)}::vector`,
      })
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(eq(documents.userId, userId))
      .orderBy(sql`${chunks.embedding} <=> ${JSON.stringify(embedding)}::vector`)
      .limit(limit)
  );
}
