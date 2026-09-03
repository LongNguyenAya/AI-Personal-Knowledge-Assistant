import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { enqueueDocumentIngestion } from "../services/document-ingestion";
import { sendIngestionMessage } from "../services/sqs";
import { assertOwnedKey, deleteFile } from "../storage/s3-storage";
import { rateLimiter } from "../middleware/rate-limit";
import { SETTINGS_REGISTRY } from "@ai-assistant/shared-types";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// Upload PDF cũng tốn 1 lệnh Gemini, giới hạn nhẹ hơn route chat vì tần suất upload đã thấp hơn.
const uploadPerHour = rateLimiter({ windowMs: 60 * 60 * 1000, maxSettingKey: "uploadPerHourLimit", name: "upload-hour" });

// Chặn sớm trước khi decode base64 vào RAM, dùng trần kỹ thuật cố định làm lưới an toàn ngoài cùng.
const uploadBodyLimit = bodyLimit({ maxSize: Math.ceil(SETTINGS_REGISTRY.maxUploadMb.max * 1024 * 1024 * 1.37) });

app.post("/documents/upload", uploadPerHour, uploadBodyLimit, async (c) => {
  const userId = c.get("userId");
  const { documentId, key, fileName, base64 } = await c.req.json();
  try {
    assertOwnedKey(userId, key);
  } catch {
    return c.json({ error: "Key không hợp lệ hoặc không thuộc về user hiện tại" }, 403);
  }
  const buffer = Buffer.from(base64, "base64");

  // Chỉ lưu file và đẩy SQS ở đây, worker nền tự nhận message rồi xử lý phần nặng.
  try {
    await enqueueDocumentIngestion(userId, documentId, key, fileName, buffer);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Thử lại tài liệu failed không cần gửi lại file, chỉ gửi lại message SQS để worker xử lý từ đầu.
app.post("/documents/retry", async (c) => {
  const userId = c.get("userId");
  const { documentId, key, fileName } = await c.req.json();
  try {
    assertOwnedKey(userId, key);
  } catch {
    return c.json({ error: "Key không hợp lệ hoặc không thuộc về user hiện tại" }, 403);
  }
  try {
    await sendIngestionMessage({ userId, documentId, key, fileName });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Xoá file vật lý, frontend đã xoá xong dòng document trước khi gọi endpoint này.
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
