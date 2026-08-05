import { Hono } from "hono";
import { saveFile } from "../storage/local-storage";
import { chunkText } from "../utils/chunk-text";
import { embedText } from "../utils/embedding";
import { db } from "../db/client";
import { chunks, documents } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

app.post("/documents/upload", async (c) => {
  const { documentId, key, fileName, base64 } = await c.req.json();
  const buffer = Buffer.from(base64, "base64");

  try {
    await saveFile(key, buffer);
    await db.update(documents).set({ status: "processing" }).where(eq(documents.id, documentId));

    // Giả sử file là .txt/.md thuần trước (PDF xử lý ở bước sau)
    const text = buffer.toString("utf-8");
    const textChunks = chunkText(text);

    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await embedText(textChunks[i]);
      await db.insert(chunks).values({
        documentId,
        content: textChunks[i],
        chunkIndex: i,
        embedding,
      });
    }

    await db.update(documents).set({ status: "processed" }).where(eq(documents.id, documentId));
    return c.json({ success: true, chunksCreated: textChunks.length });
  } catch (err) {
    await db.update(documents).set({ status: "failed" }).where(eq(documents.id, documentId));
    return c.json({ success: false, error: String(err) }, 500);
  }
});

export default app;