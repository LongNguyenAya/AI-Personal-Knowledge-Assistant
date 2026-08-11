import { embedText } from "../utils/embedding";
import { findRelevantChunks } from "../db/repositories/chunks";

const MAX_CHUNKS_PER_DOCUMENT = 3;

export async function retrieveRelevantChunks(question: string, userId: string, totalLimit = 15) {
  const embedding = await embedText(question);
  const relevantChunks = await findRelevantChunks(userId, embedding, {
    maxPerDocument: MAX_CHUNKS_PER_DOCUMENT,
    totalLimit,
  });

  const context = relevantChunks.map((c) => c.content).join("\n\n---\n\n");
  const sources = [...new Map(relevantChunks.map((c) => [c.documentId, c])).values()];

  return { context, sources };
}
