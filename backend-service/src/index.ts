import { registerTelemetry } from "ai";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { LangfuseVercelAiSdkIntegration } from "@langfuse/vercel-ai-sdk";
import { NodeSDK } from "@opentelemetry/sdk-node";

// Khởi tạo trước mọi thứ khác — tự đọc LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY/LANGFUSE_BASE_URL
// từ .env. Sau registerTelemetry(), mọi generateText/streamText của Vercel AI SDK trong toàn bộ
// app tự động được gửi trace lên Langfuse, không cần sửa gì ở từng nơi gọi model.
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

// /ws xác thực riêng qua query string (ws-auth.ts) vì trình duyệt không gửi được header
// Authorization lúc nâng cấp WebSocket — chỉ path "/ws" bỏ qua jwtAuthMiddleware, các route
// khác không đổi.
app.use("*", async (c, next) => {
  if (c.req.path === "/ws") return next();
  return jwtAuthMiddleware(c, next);
});

app.route("/", documentsRoute);
app.route("/", orchestratorRoute);
app.route("/", wsRoute);
app.route("/", emailRoute);

// Bắt lỗi throw từ bất kỳ route nào, log lại đầy đủ nhưng chỉ trả 500 chung ra ngoài — không
// lộ chi tiết lỗi nội bộ cho client.
app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: "Internal Server Error" }, 500);
});

const port = 4000;
console.log(`Backend service đang chạy ở port ${port}`);

// noServer: true bắt buộc — @hono/node-server tự wire event 'upgrade' của http.Server vào wss
// khi ta truyền websocket.server, wss không tự listen().
const wss = new WebSocketServer({ noServer: true });
serve({ fetch: app.fetch, port, websocket: { server: wss } });

startReminderScheduler();
startDocumentIngestionWorker();
