import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq } from "drizzle-orm";
import { withUserContext } from "../context";

type NewChunk = { content: string; chunkIndex: number; embedding: number[] };

// Ghi tất cả chunk của 1 tài liệu trong cùng 1 transaction — 1 tài liệu nên ghi hết hoặc không
// ghi gì, tránh dừng nửa chừng để lại vài chunk mồ côi.
export async function insertChunks(userId: string, documentId: string, items: NewChunk[]) {
  return withUserContext(userId, async (tx) => {
    for (const item of items) {
      await tx.insert(chunks).values({ documentId, ...item });
    }
  });
}

// Giới hạn tối đa maxPerDocument chunk/tài liệu trước khi lấy top totalLimit, để tài liệu dài
// (nhiều chunk) không nuốt hết chỗ của tài liệu ngắn trong top-K dù cả hai đều liên quan — dùng
// ROW_NUMBER() OVER (PARTITION BY document_id ...) để đánh số thứ hạng chunk trong từng tài liệu.
export async function findRelevantChunks(
  userId: string,
  embedding: number[],
  options: { maxPerDocument: number; totalLimit: number }
) {
  const { maxPerDocument, totalLimit } = options;
  const embeddingLiteral = JSON.stringify(embedding);

  return withUserContext(userId, (tx) => {
    const ranked = tx
      .select({
        content: chunks.content,
        documentId: documents.id,
        fileName: documents.fileName,
        distance: sql<number>`${chunks.embedding} <=> ${embeddingLiteral}::vector`.as("distance"),
        rn: sql<number>`row_number() over (partition by ${documents.id} order by ${chunks.embedding} <=> ${embeddingLiteral}::vector)`.as(
          "rn"
        ),
      })
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(eq(documents.userId, userId))
      .as("ranked");

    return tx
      .select({ content: ranked.content, documentId: ranked.documentId, fileName: ranked.fileName })
      .from(ranked)
      .where(sql`${ranked.rn} <= ${maxPerDocument}`)
      .orderBy(ranked.distance)
      .limit(totalLimit);
  });
}
