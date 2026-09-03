import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq, and, lt } from "drizzle-orm";
import type { UserScopedTx } from "./db-context";
import { getSettingValue } from "./settings";

// max-chunk-pair: với mỗi đoạn tìm đoạn gần nhất ở tài liệu khác, liên quan nếu có ít nhất 1 cặp đủ gần, tránh bị pha loãng.
export async function findRelatedDocuments(
  tx: UserScopedTx,
  userId: string,
  documentId: string,
  limit = 3
): Promise<{ documentId: string; fileName: string; distance: number }[]> {
  const embeddingRows = await tx
    .select({ embedding: chunks.embedding })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(and(eq(chunks.documentId, documentId), eq(documents.userId, userId)));

  const embeddings = embeddingRows.map((r) => r.embedding).filter((e): e is number[] => e !== null);
  if (embeddings.length === 0) return [];

  // Ngưỡng cosine hiệu chỉnh ban đầu bằng số đo thật, admin tự chỉnh qua /admin/settings nếu mẫu test nhỏ không còn đúng.
  const relatedDistanceThreshold = await getSettingValue("relatedDistanceThreshold");

  // LEAST(...) qua toàn bộ embedding của tài liệu đang xem, mỗi đoạn ứng viên ra khoảng cách tới đoạn gần nhất.
  const distanceExprs = embeddings.map((emb) => sql`${chunks.embedding} <=> ${JSON.stringify(emb)}::vector`);
  const minDistance = sql<number>`least(${sql.join(distanceExprs, sql`, `)})`;

  // Rút gọn về 1 dòng/tài liệu bằng ROW_NUMBER() OVER PARTITION BY document_id, cùng kỹ thuật ở findRelevantChunks.
  const ranked = tx
    .select({
      documentId: documents.id,
      fileName: documents.fileName,
      distance: minDistance.as("distance"),
      rn: sql<number>`row_number() over (partition by ${documents.id} order by ${minDistance})`.as("rn"),
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(and(eq(documents.userId, userId), sql`${documents.id} != ${documentId}`))
    .as("ranked");

  return tx
    .select({ documentId: ranked.documentId, fileName: ranked.fileName, distance: ranked.distance })
    .from(ranked)
    .where(and(sql`${ranked.rn} <= 1`, lt(ranked.distance, relatedDistanceThreshold)))
    .orderBy(ranked.distance)
    .limit(limit);
}
