import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { enqueueDocumentIngestion } from "../services/document-ingestion";
import { sendIngestionMessage } from "../services/sqs";
import { assertOwnedKey, deleteFile } from "../storage/s3-storage";
import { rateLimiter } from "../middleware/rate-limit";
import { SETTINGS_REGISTRY } from "@ai-assistant/shared-types";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// Uploading a PDF also costs 1 Gemini call, the limit here is looser than the chat route because upload frequency is already lower.
const uploadPerHour = rateLimiter({ windowMs: 60 * 60 * 1000, maxSettingKey: "uploadPerHourLimit", name: "upload-hour" });

// Blocks early before decoding base64 into RAM, uses a fixed technical cap as the outermost safety net.
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

  // Only saves the file and pushes to SQS here, the background worker picks up the message and handles the heavy lifting.
  try {
    await enqueueDocumentIngestion(userId, documentId, key, fileName, buffer);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Retrying a failed document doesn't need to resend the file, just pushes the SQS message again for the worker to process from scratch.
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

// Deletes the physical file, the frontend has already removed the document row before calling this endpoint.
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
