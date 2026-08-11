import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { enqueueDocumentIngestion } from "../services/document-ingestion";
import { assertOwnedKey, deleteFile } from "../storage/s3-storage";
import { rateLimiter } from "../middleware/rate-limit";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// Upload PDF cũng tốn 1 lệnh gọi Gemini (extractPdfContent) — giới hạn nhẹ hơn route chat vì
// tần suất upload vốn đã thấp hơn nhiều so với gửi tin nhắn.
const uploadPerHour = rateLimiter({ windowMs: 60 * 60 * 1000, max: 20, name: "upload-hour" });

// MAX_UPLOAD_BYTES (15MB) trong document-ingestion.ts chỉ check sau khi đã đọc và decode base64
// hết vào RAM — không chặn nổi request khổng lồ gửi thẳng vào đây. bodyLimit chặn sớm hơn, ngay
// lúc đọc request. 21MB = 15MB * 1.37 (base64 phình ra) cộng thêm chút cho phần JSON wrapper.
const uploadBodyLimit = bodyLimit({ maxSize: 21 * 1024 * 1024 });

app.post("/documents/upload", uploadPerHour, uploadBodyLimit, async (c) => {
  const userId = c.get("userId");
  const { documentId, key, fileName, base64 } = await c.req.json();
  try {
    assertOwnedKey(userId, key);
  } catch {
    return c.json({ error: "Key không hợp lệ hoặc không thuộc về user hiện tại" }, 403);
  }
  const buffer = Buffer.from(base64, "base64");

  // Chỉ lưu file + đẩy message vào SQS ở đây, không xử lý (chunk/embed) ngay trong request — worker
  // nền (workers/document-ingestion-worker.ts) sẽ tự nhận message và xử lý phần nặng đó.
  try {
    await enqueueDocumentIngestion(userId, documentId, key, fileName, buffer);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Xoá file vật lý trên đĩa — frontend đã xoá xong dòng document (kèm cascade chunks) trước khi
// gọi endpoint này, đây chỉ là dọn dẹp storage.
app.delete("/documents/file", async (c) => {
  const userId = c.get("userId");
  const { key } = await c.req.json();
  try {
    assertOwnedKey(userId, key);
  } catch {
    return c.json({ error: "Key không hợp lệ hoặc không thuộc về user hiện tại" }, 403);
  }
  await deleteFile(userId, key);
  return c.json({ ok: true });
});

export default app;
