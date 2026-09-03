import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq, and } from "drizzle-orm";
import { withUserContext } from "../context";
import type { NewChunk } from "../../types/chunks";

// Ghi tất cả chunk trong cùng 1 transaction, tránh dừng nửa chừng để lại chunk mồ côi.
export async function insertChunks(userId: string, documentId: string, items: NewChunk[]) {
  return withUserContext(userId, async (tx) => {
    for (const item of items) {
      await tx.insert(chunks).values({ documentId, ...item });
    }
  });
}

// Giới hạn maxPerDocument trước khi lấy top totalLimit, tránh tài liệu dài nuốt hết chỗ tài liệu ngắn.
export async function findRelevantChunks(
  userId: string,
  embedding: number[],
  options: { maxPerDocument: number; totalLimit: number; documentId?: string }
) {
  const { maxPerDocument, totalLimit, documentId } = options;
  const embeddingLiteral = JSON.stringify(embedding);

  return withUserContext(userId, (tx) => {
    // Có documentId nghĩa là user đã đính kèm rõ, ép cứng chỉ tìm trong đó, không rơi về tìm toàn bộ.
    const scope = documentId ? and(eq(documents.userId, userId), eq(documents.id, documentId)) : eq(documents.userId, userId);
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
      .where(scope)
      .as("ranked");

    return tx
      .select({ content: ranked.content, documentId: ranked.documentId, fileName: ranked.fileName })
      .from(ranked)
      .where(sql`${ranked.rn} <= ${maxPerDocument}`)
      .orderBy(ranked.distance)
      .limit(totalLimit);
  });
}

// Lấy toàn bộ chunk theo thứ tự gốc, kèm flaggedSuspicious để extractActionItemsTool ép hạ confidence.
export async function getDocumentChunks(userId: string, documentId: string) {
  return withUserContext(userId, (tx) =>
    tx
      .select({ content: chunks.content, flaggedSuspicious: documents.flaggedSuspicious })
      .from(chunks)
      .innerJoin(documents, eq(chunks.documentId, documents.id))
      .where(and(eq(chunks.documentId, documentId), eq(documents.userId, userId)))
      .orderBy(chunks.chunkIndex)
  );
}
