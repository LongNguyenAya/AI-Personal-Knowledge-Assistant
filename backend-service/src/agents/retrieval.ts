import { embedText } from "../utils/embedding";
import { findRelevantChunks } from "../db/repositories/chunks";

const MAX_CHUNKS_PER_DOCUMENT = 3;

// documentId đính kèm thì ép cứng chỉ tìm trong đó, không cần giới hạn maxPerDocument nữa.
export async function retrieveRelevantChunks(question: string, userId: string, totalLimit = 15, documentId?: string) {
  const embedding = await embedText(question);
  const relevantChunks = await findRelevantChunks(userId, embedding, {
    maxPerDocument: documentId ? totalLimit : MAX_CHUNKS_PER_DOCUMENT,
    totalLimit,
    documentId,
  });

  // Gắn nhãn documentId cho từng đoạn để model biết ID nào ứng với đoạn nào khi báo cáo citedDocumentIds.
  const context = relevantChunks.map((c) => `[documentId: ${c.documentId}]\n${c.content}`).join("\n\n---\n\n");
  const sources = [...new Map(relevantChunks.map((c) => [c.documentId, c])).values()];

  // Gom nội dung theo documentId để submitAnswerTool so khớp câu trả lời với đúng nguồn đã trích.
  const contentsByDocumentId = new Map<string, string[]>();
  for (const c of relevantChunks) {
    const list = contentsByDocumentId.get(c.documentId) ?? [];
    list.push(c.content);
    contentsByDocumentId.set(c.documentId, list);
  }

  return { context, sources, contentsByDocumentId };
}
