import { log } from "../utils/log";
import { saveFile, readFile } from "../storage/s3-storage";
import { chunkText } from "../utils/chunk-text";
import { embedText } from "../utils/embedding";
import { extractPdfContent } from "../utils/pdf-extraction";
import { extractImageContent } from "../utils/image-extraction";
import { extractDocxContent, extractPptxContent } from "../utils/office-extraction";
import { updateStatus, flagSuspicious } from "../db/repositories/documents";
import { insertChunks } from "../db/repositories/chunks";
import { sendIngestionMessage } from "./sqs";
import { detectPromptInjection } from "../utils/injection-detection";
import { getSettingValue } from "../db/repositories/settings";
import { sendToUser } from "../ws/registry";
import type { DocumentStatus } from "@ai-assistant/db/src/schema";

// Vừa ghi DB vừa đẩy WS ở đúng 1 chỗ, lỗi WS không được làm hỏng pipeline chính nên bọc try/catch riêng.
async function updateStatusAndNotify(userId: string, documentId: string, status: Exclude<DocumentStatus, "uploaded">) {
  await updateStatus(userId, documentId, status);
  try {
    sendToUser(userId, { type: "document_status", documentId, status });
  } catch (err) {
    log.error(`[document-ingestion] Lỗi khi đẩy WS document_status cho ${documentId} (bỏ qua):`, err);
  }
}

// Chỉ định dạng qua Gemini mới đáng kiểm tra tỷ lệ trích xuất, .txt/.md đọc thẳng buffer nên không cần.
const RATIO_CHECKED_EXTENSIONS = new Set(["pdf", "docx", "pptx", "png", "jpg", "jpeg", "webp"]);

// Định dạng lạ phải từ chối rõ ràng, không thì sẽ âm thầm đọc buffer nhị phân như text, tạo chunk rác.
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
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
      return extractImageContent(buffer, ext);
    default:
      throw new Error(`Định dạng file ".${ext}" không được hỗ trợ — chỉ nhận .pdf, .docx, .pptx, .txt, .md, .png, .jpg, .jpeg, .webp.`);
  }
}

// Giai đoạn 1 chạy trong request HTTP phải nhanh, chỉ lưu file rồi đẩy message SQS mang mỗi key.
export async function enqueueDocumentIngestion(
  userId: string,
  documentId: string,
  key: string,
  fileName: string,
  buffer: Buffer
): Promise<void> {
  // Admin tự chỉnh qua /admin/settings, backend tự kiểm tra lại vì ai có JWT hợp lệ vẫn gọi thẳng được.
  const maxUploadBytes = (await getSettingValue("maxUploadMb")) * 1024 * 1024;
  if (buffer.length > maxUploadBytes) {
    throw new Error(`File quá lớn (${buffer.length} bytes) — vượt giới hạn ${maxUploadBytes} bytes.`);
  }
  await saveFile(userId, key, buffer);
  await sendIngestionMessage({ userId, documentId, key, fileName });
}

// Giai đoạn 2 (worker nền): chunk, embed, ghi DB, cập nhật status, lỗi bất kỳ bước nào đều thành failed.
export async function processDocumentIngestion(
  userId: string,
  documentId: string,
  key: string,
  fileName: string
): Promise<{ success: true; chunksCreated: number } | { success: false; error: string }> {
  try {
    await updateStatusAndNotify(userId, documentId, "processing");

    const buffer = await readFile(userId, key);
    const text = await extractText(fileName, buffer);
    const ext = fileName.toLowerCase().split(".").pop() ?? "";

    // Gộp 2 lý do khả dĩ vào đúng 1 lần gọi flagSuspicious, gọi riêng 2 lần sẽ ghi đè mất lý do trước.
    let flagReason: string | null = null;
    try {
      const { flagged, reason } = detectPromptInjection(text);
      if (flagged && reason) flagReason = reason;
    } catch (err) {
      log.error(`[document-ingestion] Lỗi khi quét injection cho document ${documentId} (bỏ qua, không chặn ingest):`, err);
    }

    // Cảnh báo "có thể trích thiếu" chỉ để tự kiểm tra, ngưỡng đọc từ system_settings.
    const minCharsPerKb = await getSettingValue("minCharsPerKb");
    if (RATIO_CHECKED_EXTENSIONS.has(ext) && text.length < (buffer.length / 1024) * minCharsPerKb) {
      const shortReason = `Trích xuất được ít nội dung (${text.length} ký tự) so với kích thước file (${Math.round(buffer.length / 1024)}KB) — có thể còn thiếu, bạn nên tự kiểm tra lại.`;
      flagReason = flagReason ? `${flagReason} ${shortReason}` : shortReason;
    }

    // Quét và đánh dấu ngay sau khi có nội dung thô, chỉ cảnh báo chứ không chặn xử lý.
    if (flagReason) {
      try {
        await flagSuspicious(userId, documentId, flagReason);
      } catch (flagErr) {
        log.error(`[document-ingestion] Lỗi khi đánh dấu document ${documentId} (bỏ qua, không chặn ingest):`, flagErr);
      }
    }

    const textChunks = chunkText(text);

    const items = [];
    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await embedText(textChunks[i]);
      items.push({ content: textChunks[i], chunkIndex: i, embedding });
    }
    await insertChunks(userId, documentId, items);

    await updateStatusAndNotify(userId, documentId, "processed");
    return { success: true as const, chunksCreated: textChunks.length };
  } catch (err) {
    // updateStatus cũng có thể lỗi, không bọc riêng thì document kẹt vĩnh viễn ở processing.
    try {
      await updateStatusAndNotify(userId, documentId, "failed");
    } catch (statusErr) {
      log.error(`[document-ingestion] Không thể đánh dấu document ${documentId} là "failed" sau lỗi gốc:`, statusErr);
    }
    return { success: false as const, error: String(err) };
  }
}
