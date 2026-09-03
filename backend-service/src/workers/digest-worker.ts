import { log } from "../utils/log";
import { receiveDigestTriggerMessages, deleteDigestTriggerMessage } from "../services/sqs";
import { generateWeeklyDigests } from "../services/weekly-digest";

// Nội dung message không quan trọng, nhận được là chạy generateWeeklyDigests() cho toàn bộ user.
async function pollOnce(): Promise<void> {
  const messages = await receiveDigestTriggerMessages();

  for (const message of messages) {
    try {
      await generateWeeklyDigests();
    } catch (err) {
      log.error("[digest-worker] Lỗi không mong đợi khi tạo digest tuần:", err);
    } finally {
      if (message.ReceiptHandle) {
        await deleteDigestTriggerMessage(message.ReceiptHandle).catch((err) =>
          log.error("[digest-worker] Không xoá được message khỏi queue:", err)
        );
      }
    }
  }
}

// Cùng khuôn mẫu document-ingestion-worker.ts, vòng lặp tự lên lịch lại nhờ long polling.
export function startDigestWorker(): void {
  let running = true;

  (async () => {
    while (running) {
      try {
        await pollOnce();
      } catch (err) {
        log.error("[digest-worker] Lỗi khi poll SQS, thử lại sau 5s:", err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  })();

  log.info("[digest-worker] Đã khởi động.");

  process.on("SIGTERM", () => {
    running = false;
  });
}
