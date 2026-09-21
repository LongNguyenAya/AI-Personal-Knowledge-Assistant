import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq, and } from "drizzle-orm";
import { withUserContext } from "../context";
import type { NewChunk } from "../../types/chunks";

// Writes all chunks in the same transaction, avoiding a mid-way stop that leaves orphaned chunks.
// Returns the inserted rows (id + content) so a caller like knowledge-graph extraction can run per chunk afterward.
export async function insertChunks(userId: string, documentId: string, items: NewChunk[]) {
  return withUserContext(userId, async (tx) => {
    const inserted: { id: string; content: string }[] = [];
    for (const item of items) {
      const [row] = await tx.insert(chunks).values({ documentId, ...item }).returning({ id: chunks.id, content: chunks.content });
      inserted.push(row);
    }
    return inserted;
  });
}

// Caps maxPerDocument before taking the top totalLimit, preventing a long document from crowding out shorter ones.
export async function findRelevantChunks(
  userId: string,
  embedding: number[],
  options: { maxPerDocument: number; totalLimit: number; documentId?: string }
) {
  const { maxPerDocument, totalLimit, documentId } = options;
  const embeddingLiteral = JSON.stringify(embedding);

  return withUserContext(userId, (tx) => {
    // Having a documentId means the user attached it explicitly, forces the search to stay within it instead of falling back to searching everything.
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

// Fetches all chunks in their original order, including flaggedSuspicious so extractActionItemsTool can force confidence down.
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
