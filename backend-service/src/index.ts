import { registerTelemetry } from "ai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Khởi tạo trước mọi thứ khác, sau registerTelemetry() mọi lệnh gọi AI SDK tự động gửi trace lên Langfuse.
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
import { startDocumentIngestionWorker } from "./workers/document-ingestion-worker";
import { startDigestWorker } from "./workers/digest-worker";
import type { AppEnv } from "./types";

if (!process.env.JWT_PUBLIC_KEY) {
  throw new Error("JWT_PUBLIC_KEY chưa được set trong .env — backend-service không thể khởi động an toàn.");
}
if (!process.env.DATABASE_ADMIN_URL) {
  throw new Error("DATABASE_ADMIN_URL chưa được set trong .env — scheduler cần role admin_user để quét reminder của mọi user.");
}
if (!process.env.SQS_QUEUE_URL) {
  throw new Error("SQS_QUEUE_URL chưa được set trong .env — cần cho worker xử lý tài liệu nền.");
}
if (!process.env.S3_BUCKET_NAME) {
  throw new Error("S3_BUCKET_NAME chưa được set trong .env — cần để lưu file tài liệu upload.");
}

const app = new Hono<AppEnv>();

// /ws xác thực riêng qua query string, chỉ path này bỏ qua jwtAuthMiddleware.
app.use("*", async (c, next) => {
  if (c.req.path === "/ws") return next();
  return jwtAuthMiddleware(c, next);
});

app.route("/", documentsRoute);
app.route("/", orchestratorRoute);
app.route("/", wsRoute);
app.route("/", emailRoute);

// Bắt lỗi throw từ bất kỳ route nào, log đầy đủ nhưng chỉ trả 500 chung, không lộ chi tiết cho client.
app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = 4000;
console.log(`Backend service đang chạy ở port ${port}`);

// noServer: true bắt buộc, @hono/node-server tự wire event upgrade vào wss, wss không tự listen().
const wss = new WebSocketServer({ noServer: true });
serve({ fetch: app.fetch, port, websocket: { server: wss } });

startReminderScheduler();
startDocumentIngestionWorker();

// Không throw cứng như 2 biến kia vì queue này cần tạo thủ công trên AWS Console, chưa có cũng không chặn khởi động.
if (process.env.WEEKLY_DIGEST_QUEUE_URL) {
  startDigestWorker();
} else {
  console.warn("[digest-worker] WEEKLY_DIGEST_QUEUE_URL chưa được set trong .env — bỏ qua, tính năng tóm tắt tuần sẽ không chạy.");
}
