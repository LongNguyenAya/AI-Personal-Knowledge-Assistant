import { log } from "../utils/log";
import { receiveIngestionMessages, deleteIngestionMessage } from "../services/sqs";
import { processDocumentIngestion } from "../services/document-ingestion";
import type { DocumentIngestionMessage } from "../types/sqs";

// 1 vòng chờ tối đa 20s để nhận message, luôn xoá khỏi queue dù thành công hay thất bại.
async function pollOnce(): Promise<void> {
  const messages = await receiveIngestionMessages();

  for (const message of messages) {
    try {
      const payload = JSON.parse(message.Body ?? "{}") as DocumentIngestionMessage;
      await processDocumentIngestion(payload.userId, payload.documentId, payload.key, payload.fileName);
    } catch (err) {
      log.error("[document-ingestion-worker] Lỗi không mong đợi khi xử lý message:", err);
    } finally {
      if (message.ReceiptHandle) {
        await deleteIngestionMessage(message.ReceiptHandle).catch((err) =>
          log.error("[document-ingestion-worker] Không xoá được message khỏi queue:", err)
        );
      }
    }
  }
}

// Vòng lặp tự lên lịch lại chính nó, long polling đã tự chờ nên không cần hẹn giờ riêng.
export function startDocumentIngestionWorker(): void {
  let running = true;

  (async () => {
    while (running) {
      try {
        await pollOnce();
      } catch (err) {
        log.error("[document-ingestion-worker] Lỗi khi poll SQS, thử lại sau 5s:", err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();

  log.info("[document-ingestion-worker] Đã khởi động.");

  process.on("SIGTERM", () => {
    running = false;
  });
}
