import { serve } from "@hono/node-server";
import { Hono } from "hono";
import documentsRoute from "./routes/documents";
import chatRoute from "./routes/chat";
import actionRoute from "./routes/action";
import orchestratorRoute from "./routes/orchestrator";

const app = new Hono();

app.route("/", documentsRoute);
app.route("/", chatRoute);
app.route("/", actionRoute);
app.route("/", orchestratorRoute);

const port = 4000;
console.log(`Backend service đang chạy ở port ${port}`);

serve({ fetch: app.fetch, port });