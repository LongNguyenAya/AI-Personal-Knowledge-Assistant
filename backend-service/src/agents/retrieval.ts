import { embedText } from "../utils/embedding";
import { findRelevantChunks } from "../db/repositories/chunks";

const MAX_CHUNKS_PER_DOCUMENT = 3;

// With a documentId attached, the search is forced to stay within it, no need for the maxPerDocument cap anymore.
export async function retrieveRelevantChunks(question: string, userId: string, totalLimit = 15, documentId?: string) {
  const embedding = await embedText(question);
  const relevantChunks = await findRelevantChunks(userId, embedding, {
    maxPerDocument: documentId ? totalLimit : MAX_CHUNKS_PER_DOCUMENT,
    totalLimit,
    documentId,
  });

  // Tags each chunk with its documentId so the model knows which ID matches which chunk when reporting citedDocumentIds.
  const context = relevantChunks.map((c) => `[documentId: ${c.documentId}]\n${c.content}`).join("\n\n---\n\n");
  const sources = [...new Map(relevantChunks.map((c) => [c.documentId, c])).values()];

  // Groups content by documentId so submitAnswerTool can match the answer against the exact source it cited.
  const contentsByDocumentId = new Map<string, string[]>();
  for (const c of relevantChunks) {
    const list = contentsByDocumentId.get(c.documentId) ?? [];
    list.push(c.content);
    contentsByDocumentId.set(c.documentId, list);
  }

  return { context, sources, contentsByDocumentId };
}
