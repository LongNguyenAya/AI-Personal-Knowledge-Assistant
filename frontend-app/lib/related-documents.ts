import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq, and, lt } from "drizzle-orm";
import type { UserScopedTx } from "./db-context";
import { getSettingValue } from "./settings";

// max-chunk-pair: for each chunk it finds the closest chunk in another document, related if at least 1 pair is close enough, avoiding dilution.
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

  // The cosine threshold was initially calibrated with real measurements, admin can adjust it via /admin/settings if the small test sample stops being accurate.
  const relatedDistanceThreshold = await getSettingValue("relatedDistanceThreshold");

  // LEAST(...) across every embedding of the document being viewed, each candidate chunk gets the distance to its closest match.
  const distanceExprs = embeddings.map((emb) => sql`${chunks.embedding} <=> ${JSON.stringify(emb)}::vector`);
  const minDistance = sql<number>`least(${sql.join(distanceExprs, sql`, `)})`;

  // Collapsed to 1 row per document using ROW_NUMBER() OVER PARTITION BY document_id, the same technique used in findRelevantChunks.
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
