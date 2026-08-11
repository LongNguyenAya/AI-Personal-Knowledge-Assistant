import { receiveIngestionMessages, deleteIngestionMessage } from "../services/sqs";
import { processDocumentIngestion } from "../services/document-ingestion";
import type { DocumentIngestionMessage } from "../services/sqs";

// 1 vòng: chờ tối đa 20s (long polling, xem receiveIngestionMessages) để nhận 1 message, xử lý,
// rồi luôn xoá message khỏi queue dù thành công hay thất bại — processDocumentIngestion tự bắt
// lỗi và đánh dấu "failed", không dựa vào cơ chế retry tự động của SQS (tránh phải dựng thêm
// dead-letter queue chỉ để chặn retry vô hạn, không cần thiết ở quy mô demo).
async function pollOnce(): Promise<void> {
  const messages = await receiveIngestionMessages();

  for (const message of messages) {
    try {
      const payload = JSON.parse(message.Body ?? "{}") as DocumentIngestionMessage;
      await processDocumentIngestion(payload.userId, payload.documentId, payload.key, payload.fileName);
    } catch (err) {
      console.error("[document-ingestion-worker] Lỗi không mong đợi khi xử lý message:", err);
    } finally {
      if (message.ReceiptHandle) {
        await deleteIngestionMessage(message.ReceiptHandle).catch((err) =>
          console.error("[document-ingestion-worker] Không xoá được message khỏi queue:", err)
        );
      }
    }
  }
}

// Vòng lặp tự lên lịch lại chính nó thay vì setInterval — receiveIngestionMessages() đã tự chờ
// (long polling) nên không cần hẹn giờ riêng, chỉ cần gọi lại ngay khi vòng trước xong.
export function startDocumentIngestionWorker(): void {
  let running = true;

  (async () => {
    while (running) {
      try {
        await pollOnce();
      } catch (err) {
        console.error("[document-ingestion-worker] Lỗi khi poll SQS, thử lại sau 5s:", err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();

  console.log("[document-ingestion-worker] Đã khởi động.");

  process.on("SIGTERM", () => {
    running = false;
  });
}
