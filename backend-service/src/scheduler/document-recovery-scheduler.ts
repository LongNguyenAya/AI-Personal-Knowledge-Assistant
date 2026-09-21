import { log } from "../utils/log";
import { findStuckUploadedDocuments, markIngestionRetried, findExhaustedUploadedDocuments, markIngestionGivenUp } from "../db/repositories/documents";
import { sendIngestionMessage } from "../services/sqs";
import { sendToUser } from "../ws/registry";

const POLL_INTERVAL_MS = 60_000;
// A normal ingestion reaches "processing" within seconds, staying at "uploaded" this long means its
// SQS message was lost or the worker crashed mid-processing before ever updating status.
const STALE_AFTER_MS = 2 * 60_000;
const MAX_AUTO_RETRIES = 3;

async function recoverStuckDocuments() {
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const stuck = await findStuckUploadedDocuments(cutoff, MAX_AUTO_RETRIES);
    for (const doc of stuck) {
      try {
        await sendIngestionMessage({ userId: doc.userId, documentId: doc.id, key: doc.s3Key, fileName: doc.fileName });
        await markIngestionRetried(doc.id);
        log.info(`[document-recovery] Đã tự động thử lại document ${doc.id} (${doc.fileName}) kẹt ở "uploaded".`);
      } catch (err) {
        // A separate try/catch per document, without it 1 SQS/DB error would skip the other stuck documents.
        log.error(`[document-recovery] Lỗi khi tự động thử lại document ${doc.id}, sẽ thử lại lượt sau:`, err);
      }
    }
  } catch (err) {
    log.error("[document-recovery] Lỗi khi quét document kẹt ở \"uploaded\":", err);
  }
}

async function giveUpOnExhaustedDocuments() {
  try {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);
    const exhausted = await findExhaustedUploadedDocuments(cutoff, MAX_AUTO_RETRIES);
    for (const doc of exhausted) {
      try {
        await markIngestionGivenUp(doc.id);
        sendToUser(doc.userId, { type: "document_status", documentId: doc.id, status: "failed" });
        log.info(`[document-recovery] Document ${doc.id} đã hết lượt tự động thử lại (${MAX_AUTO_RETRIES}), chuyển sang "failed".`);
      } catch (err) {
        log.error(`[document-recovery] Lỗi khi đánh dấu document ${doc.id} là "failed" sau khi hết lượt thử lại:`, err);
      }
    }
  } catch (err) {
    log.error("[document-recovery] Lỗi khi quét document đã hết lượt tự động thử lại:", err);
  }
}

export function startDocumentRecoveryScheduler(): void {
  let isRunning = false;
  const tick = async () => {
    if (isRunning) {
      log.warn("[document-recovery] Lượt quét trước chưa xong, bỏ qua lượt này.");
      return;
    }
    isRunning = true;
    try {
      // Order matters: a document must first be given the chance to retry MAX_AUTO_RETRIES times
      // before being written off, doing it in the other order would give up 1 tick too early.
      await recoverStuckDocuments();
      await giveUpOnExhaustedDocuments();
    } finally {
      isRunning = false;
    }
  };
  tick();
  setInterval(tick, POLL_INTERVAL_MS);
  log.info(`[document-recovery] Document recovery scheduler đã khởi động, quét mỗi ${POLL_INTERVAL_MS / 1000}s.`);
}
