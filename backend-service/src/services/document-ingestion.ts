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

// Writes to DB and pushes over WS in the same spot, a WS error must not break the main pipeline so it's wrapped in its own try/catch.
async function updateStatusAndNotify(userId: string, documentId: string, status: Exclude<DocumentStatus, "uploaded">) {
  await updateStatus(userId, documentId, status);
  try {
    sendToUser(userId, { type: "document_status", documentId, status });
  } catch (err) {
    log.error(`[document-ingestion] Lỗi khi đẩy WS document_status cho ${documentId} (bỏ qua):`, err);
  }
}

// Only formats going through Gemini are worth checking extraction ratio for, .txt/.md read the buffer directly so it's unnecessary.
const RATIO_CHECKED_EXTENSIONS = new Set(["pdf", "docx", "pptx", "png", "jpg", "jpeg", "webp"]);

// Unknown formats must be rejected explicitly, otherwise it would silently read binary buffers as text, creating garbage chunks.
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

// Stage 1 runs inside the HTTP request and must be fast, just saves the file then pushes an SQS message carrying only the key.
export async function enqueueDocumentIngestion(
  userId: string,
  documentId: string,
  key: string,
  fileName: string,
  buffer: Buffer
): Promise<void> {
  // Admin adjusts this via /admin/settings, the backend re-checks it because anyone with a valid JWT can still call directly.
  const maxUploadBytes = (await getSettingValue("maxUploadMb")) * 1024 * 1024;
  if (buffer.length > maxUploadBytes) {
    throw new Error(`File quá lớn (${buffer.length} bytes) — vượt giới hạn ${maxUploadBytes} bytes.`);
  }
  await saveFile(userId, key, buffer);
  await sendIngestionMessage({ userId, documentId, key, fileName });
}

// Stage 2 (background worker): chunk, embed, write to DB, update status, an error at any step becomes failed.
export async function processDocumentIngestion(
  userId: string,
  documentId: string,
  key: string,
  fileName: string
): Promise<{ success: true; chunksCreated: number } | { success: false; error: string }> {
  try {
    log.info(`[document-ingestion] Bắt đầu xử lý document ${documentId} (${fileName})`);
    await updateStatusAndNotify(userId, documentId, "processing");

    const buffer = await readFile(userId, key);
    log.info(`[document-ingestion] Đã đọc file ${documentId} từ S3, ${buffer.length} bytes`);
    const text = await extractText(fileName, buffer);
    log.info(`[document-ingestion] Đã trích xuất text ${documentId}, ${text.length} ký tự`);
    const ext = fileName.toLowerCase().split(".").pop() ?? "";

    // Merges the 2 possible reasons into exactly 1 call to flagSuspicious, calling it twice separately would overwrite the earlier reason.
    let flagReason: string | null = null;
    try {
      const { flagged, reason } = detectPromptInjection(text);
      if (flagged && reason) flagReason = reason;
    } catch (err) {
      log.error(`[document-ingestion] Lỗi khi quét injection cho document ${documentId} (bỏ qua, không chặn ingest):`, err);
    }

    // The "possibly under-extracted" warning is just a self-check, the threshold is read from system_settings.
    const minCharsPerKb = await getSettingValue("minCharsPerKb");
    if (RATIO_CHECKED_EXTENSIONS.has(ext) && text.length < (buffer.length / 1024) * minCharsPerKb) {
      const shortReason = `Trích xuất được ít nội dung (${text.length} ký tự) so với kích thước file (${Math.round(buffer.length / 1024)}KB) — có thể còn thiếu, bạn nên tự kiểm tra lại.`;
      flagReason = flagReason ? `${flagReason} ${shortReason}` : shortReason;
    }

    // Scans and flags right after the raw content is available, only warns, never blocks processing.
    if (flagReason) {
      try {
        await flagSuspicious(userId, documentId, flagReason);
      } catch (flagErr) {
        log.error(`[document-ingestion] Lỗi khi đánh dấu document ${documentId} (bỏ qua, không chặn ingest):`, flagErr);
      }
    }

    const textChunks = chunkText(text);
    log.info(`[document-ingestion] Đã chia ${documentId} thành ${textChunks.length} chunk, bắt đầu embedding`);

    const items = [];
    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await embedText(textChunks[i]);
      items.push({ content: textChunks[i], chunkIndex: i, embedding });
    }
    log.info(`[document-ingestion] Đã embed xong ${textChunks.length} chunk cho ${documentId}, ghi vào DB`);
    await insertChunks(userId, documentId, items);
    log.info(`[document-ingestion] Đã ghi chunks cho ${documentId}, cập nhật status "processed"`);

    await updateStatusAndNotify(userId, documentId, "processed");
    log.info(`[document-ingestion] Hoàn tất document ${documentId}`);
    return { success: true as const, chunksCreated: textChunks.length };
  } catch (err) {
    // Logs the real error immediately, String(err) in the return value alone was silently swallowed by the caller before.
    log.error(`[document-ingestion] Lỗi khi xử lý document ${documentId}:`, err);
    // updateStatus can also fail, without its own wrapper the document would get stuck in processing forever.
    try {
      await updateStatusAndNotify(userId, documentId, "failed");
    } catch (statusErr) {
      log.error(`[document-ingestion] Không thể đánh dấu document ${documentId} là "failed" sau lỗi gốc:`, statusErr);
    }
    return { success: false as const, error: String(err) };
  }
}
