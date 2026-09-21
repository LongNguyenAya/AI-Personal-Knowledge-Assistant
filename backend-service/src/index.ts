import { registerTelemetry } from "ai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Initialized before everything else, after registerTelemetry() every AI SDK call automatically sends a trace to Langfuse.
const sdk = new NodeSDK({
  spanProcessors: [new LangfuseSpanProcessor()],
});
sdk.start();
registerTelemetry(new LangfuseVercelAiSdkIntegration());

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import documentsRoute from "./routes/documents";
import orchestratorRoute from "./routes/orchestrator";
import wsRoute from "./routes/ws";
import emailRoute from "./routes/email";
import { jwtAuthMiddleware } from "./middleware/jwt-auth";
import { startReminderScheduler } from "./scheduler/reminder-scheduler";
import { startDocumentRecoveryScheduler } from "./scheduler/document-recovery-scheduler";
import { startDocumentIngestionWorker } from "./workers/document-ingestion-worker";
import { startDigestWorker } from "./workers/digest-worker";
import type { AppEnv } from "./types";

if (!process.env.JWT_PUBLIC_KEY) {
  throw new Error("JWT_PUBLIC_KEY chưa được set trong .env, backend-service không thể khởi động an toàn.");
}
if (!process.env.DATABASE_ADMIN_URL) {
  throw new Error("DATABASE_ADMIN_URL chưa được set trong .env, scheduler cần role admin_user để quét reminder của mọi user.");
}
if (!process.env.SQS_QUEUE_URL) {
  throw new Error("SQS_QUEUE_URL chưa được set trong .env, cần cho worker xử lý tài liệu nền.");
}
if (!process.env.S3_BUCKET_NAME) {
  throw new Error("S3_BUCKET_NAME chưa được set trong .env, cần để lưu file tài liệu upload.");
}

const app = new Hono<AppEnv>();

// /ws authenticates separately via query string, this is the only path that skips jwtAuthMiddleware.
app.use("*", async (c, next) => {
  if (c.req.path === "/ws") return next();
  return jwtAuthMiddleware(c, next);
});

app.route("/", documentsRoute);
app.route("/", orchestratorRoute);
app.route("/", wsRoute);
app.route("/", emailRoute);

// Catches an error thrown from any route, logs it in full but only returns a generic 500, no details leaked to the client.
app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = 4000;
console.log(`Backend service đang chạy ở port ${port}`);

// noServer: true is required, @hono/node-server wires the upgrade event into wss itself, wss doesn't call listen() on its own.
const wss = new WebSocketServer({ noServer: true });
serve({ fetch: app.fetch, port, websocket: { server: wss } });

startReminderScheduler();
startDocumentRecoveryScheduler();
startDocumentIngestionWorker();

// Doesn't hard-throw like the other 2 env vars since this queue has to be created manually on the AWS Console, missing it doesn't block startup.
if (process.env.WEEKLY_DIGEST_QUEUE_URL) {
  startDigestWorker();
} else {
  console.warn("[digest-worker] WEEKLY_DIGEST_QUEUE_URL chưa được set trong .env, bỏ qua, tính năng tóm tắt tuần sẽ không chạy.");
}
