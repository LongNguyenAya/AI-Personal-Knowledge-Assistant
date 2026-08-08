import { serve } from "@hono/node-server";
import { Hono } from "hono";
import documentsRoute from "./routes/documents";
import chatRoute from "./routes/chat";
import actionRoute from "./routes/action";
import orchestratorRoute from "./routes/orchestrator";
import { jwtAuthMiddleware } from "./middleware/jwt-auth";
import type { AppEnv } from "./types";

if (!process.env.JWT_PUBLIC_KEY) {
  throw new Error("JWT_PUBLIC_KEY chưa được set trong .env — backend-service không thể khởi động an toàn.");
}

const app = new Hono<AppEnv>();

app.use("*", jwtAuthMiddleware);

app.route("/", documentsRoute);
app.route("/", chatRoute);
app.route("/", actionRoute);
app.route("/", orchestratorRoute);

const port = 4000;
console.log(`Backend service đang chạy ở port ${port}`);

serve({ fetch: app.fetch, port });
