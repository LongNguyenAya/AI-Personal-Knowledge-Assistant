import { saveFile } from "../storage/local-storage";
import { chunkText } from "../utils/chunk-text";
import { embedText } from "../utils/embedding";
import { updateStatus } from "../db/repositories/documents";
import { insertChunks } from "../db/repositories/chunks";

// Toàn bộ pipeline "upload 1 tài liệu": lưu file -> chunk -> embed từng đoạn -> ghi DB ->
// cập nhật status. saveFile cố ý nằm trong cùng khối try như code gốc — lỗi ở bước lưu file
// cũng phải đánh dấu tài liệu "failed", không chỉ lỗi ở bước embed/DB.
export async function ingestDocument(userId: string, documentId: string, key: string, buffer: Buffer) {
  try {
    await saveFile(key, buffer);
    await updateStatus(userId, documentId, "processing");

    // Giả sử file là .txt/.md thuần trước (PDF xử lý ở bước sau)
    const text = buffer.toString("utf-8");
    const textChunks = chunkText(text);

    const items = [];
    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await embedText(textChunks[i]);
      items.push({ content: textChunks[i], chunkIndex: i, embedding });
    }
    await insertChunks(userId, documentId, items);

    await updateStatus(userId, documentId, "processed");
    return { success: true as const, chunksCreated: textChunks.length };
  } catch (err) {
    await updateStatus(userId, documentId, "failed");
    return { success: false as const, error: String(err) };
  }
}
