import { Hono } from "hono";
import { ingestDocument } from "../services/document-ingestion";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.post("/documents/upload", async (c) => {
  const userId = c.get("userId");
  const { documentId, key, base64 } = await c.req.json();
  const buffer = Buffer.from(base64, "base64");

  const result = await ingestDocument(userId, documentId, key, buffer);
  return c.json(result, result.success ? 200 : 500);
});

export default app;
