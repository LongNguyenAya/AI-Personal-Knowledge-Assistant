import { embedText } from "../utils/embedding";
import { findRelevantChunks } from "../db/repositories/chunks";

export async function retrieveRelevantChunks(question: string, userId: string, limit = 5) {
  const embedding = await embedText(question);
  const relevantChunks = await findRelevantChunks(userId, embedding, limit);

  const context = relevantChunks.map((c) => c.content).join("\n\n---\n\n");
  const sources = [...new Map(relevantChunks.map((c) => [c.documentId, c])).values()];

  return { context, sources };
}
