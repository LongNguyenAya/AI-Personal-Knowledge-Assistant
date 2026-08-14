import { saveFile, readFile } from "../storage/s3-storage";
import { chunkText } from "../utils/chunk-text";
import { embedText } from "../utils/embedding";
import { extractPdfContent } from "../utils/pdf-extraction";
import { extractDocxContent, extractPptxContent } from "../utils/office-extraction";
import { updateStatus } from "../db/repositories/documents";
import { insertChunks } from "../db/repositories/chunks";
import { sendIngestionMessage } from "./sqs";

// PDF còn bị chặn thêm bởi MAX_PDF_BYTES riêng (pdf-extraction.ts, do giới hạn inline PDF của
// Gemini) — các định dạng khác chỉ bị chặn bởi giới hạn chung này. frontend-app có chặn ở tầng
// của nó, nhưng ai có JWT hợp lệ vẫn gọi thẳng được endpoint này, nên backend không nên chỉ tin
// tầng gọi.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

// Định dạng lạ (vd .png, .csv, .doc/.ppt bản cũ dạng binary) PHẢI bị từ chối rõ ràng ở đây — nếu
// không, nhánh mặc định trước đây sẽ âm thầm đọc buffer nhị phân như UTF-8 text, tạo ra chunk rác,
// tốn lệnh gọi embedding vô ích, và document vẫn báo "processed" dù nội dung hoàn toàn vô nghĩa.
async function extractText(fileName: string, buffer: Buffer): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "pdf":
      return extractPdfContent(buffer);
    case "docx":
      return extractDocxContent(buffer);
    case "pptx":
      return extractPptxContent(buffer);
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Định dạng file ".${ext}" không được hỗ trợ — chỉ nhận .pdf, .docx, .pptx, .txt, .md.`);
  }
}

// Giai đoạn 1, chạy trong request HTTP — phải nhanh. Chỉ lưu file rồi đẩy 1 message vào SQS,
// không xử lý (chunk/embed) ở đây. Message chỉ mang key, không mang bytes (giới hạn 1 message
// SQS là 256KB, trong khi file có thể tới 15MB) — worker sẽ tự đọc lại file qua key.
export async function enqueueDocumentIngestion(
  userId: string,
  documentId: string,
  key: string,
  fileName: string,
  buffer: Buffer
): Promise<void> {
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File quá lớn (${buffer.length} bytes) — vượt giới hạn ${MAX_UPLOAD_BYTES} bytes.`);
  }
  await saveFile(userId, key, buffer);
  await sendIngestionMessage({ userId, documentId, key, fileName });
}

// Giai đoạn 2, chạy trong worker nền (workers/document-ingestion-worker.ts) khi nhận được
// message từ SQS: chunk -> embed từng đoạn -> ghi DB -> cập nhật status. Lỗi ở bất kỳ bước nào
// đều phải đánh dấu tài liệu "failed", nên tất cả nằm chung 1 khối try — và luôn tự bắt lỗi,
// không throw ra ngoài, vì worker gọi hàm này sẽ xoá message khỏi queue ngay sau khi gọi xong
// bất kể thành công hay thất bại (không dùng cơ chế retry tự động của SQS).
export async function processDocumentIngestion(
  userId: string,
  documentId: string,
  key: string,
  fileName: string
): Promise<{ success: true; chunksCreated: number } | { success: false; error: string }> {
  try {
    await updateStatus(userId, documentId, "processing");

    const buffer = await readFile(userId, key);
    const text = await extractText(fileName, buffer);
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
    // updateStatus cũng có thể lỗi (thường cùng nguyên nhân với lỗi gốc, vd DB hiccup) — không
    // bọc riêng thì lỗi này văng ra ngoài, document kẹt vĩnh viễn ở "processing" mà không ai biết.
    try {
      await updateStatus(userId, documentId, "failed");
    } catch (statusErr) {
      console.error(`[document-ingestion] Không thể đánh dấu document ${documentId} là "failed" sau lỗi gốc:`, statusErr);
    }
    return { success: false as const, error: String(err) };
  }
}
