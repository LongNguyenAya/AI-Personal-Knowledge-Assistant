import { embedText } from "../utils/embedding";
import { findRelevantChunks } from "../db/repositories/chunks";

const MAX_CHUNKS_PER_DOCUMENT = 3;

export async function retrieveRelevantChunks(question: string, userId: string, totalLimit = 15) {
  const embedding = await embedText(question);
  const relevantChunks = await findRelevantChunks(userId, embedding, {
    maxPerDocument: MAX_CHUNKS_PER_DOCUMENT,
    totalLimit,
  });

  // Gắn nhãn documentId cho từng đoạn — bắt buộc để model biết ID nào ứng với đoạn nào khi phải
  // báo cáo citedDocumentIds qua tool submitAnswer (xem tools/submit-answer.ts), không có nhãn này
  // model không có cách nào biết ID hợp lệ để trích.
  const context = relevantChunks.map((c) => `[documentId: ${c.documentId}]\n${c.content}`).join("\n\n---\n\n");
  const sources = [...new Map(relevantChunks.map((c) => [c.documentId, c])).values()];

  // Gom nội dung thật theo documentId — submitAnswerTool cần cái này để so khớp câu trả lời với
  // ĐÚNG nội dung nguồn đã trích (không chỉ kiểm tra ID có tồn tại), 1 tài liệu có thể góp nhiều chunk.
  const contentsByDocumentId = new Map<string, string[]>();
  for (const c of relevantChunks) {
    const list = contentsByDocumentId.get(c.documentId) ?? [];
    list.push(c.content);
    contentsByDocumentId.set(c.documentId, list);
  }

  return { context, sources, contentsByDocumentId };
}
