import { log } from "../utils/log";
import { receiveIngestionMessages, deleteIngestionMessage } from "../services/sqs";
import { processDocumentIngestion } from "../services/document-ingestion";
import type { DocumentIngestionMessage } from "../types/sqs";

// 1 loop waits up to 20s to receive a message, always removed from the queue whether it succeeds or fails.
async function pollOnce(): Promise<void> {
  const messages = await receiveIngestionMessages();

  for (const message of messages) {
    try {
      const payload = JSON.parse(message.Body ?? "{}") as DocumentIngestionMessage;
      // processDocumentIngestion catches its own errors and returns {success:false}, without this check that error was silently discarded.
      const result = await processDocumentIngestion(payload.userId, payload.documentId, payload.key, payload.fileName);
      if (!result.success) {
        log.error(`[document-ingestion-worker] Xử lý document ${payload.documentId} thất bại:`, result.error);
      }
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

// The loop reschedules itself, long polling already waits on its own so no separate timer is needed.
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
