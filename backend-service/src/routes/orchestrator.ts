import { Hono } from "hono";
import { runOrchestrator } from "../agents/orchestrator";

const app = new Hono();

app.post("/agent/orchestrate", async (c) => {
  const userId = c.req.header("X-User-Id");
  const { message } = await c.req.json();

  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const response = await runOrchestrator(message, userId);
  return c.json({ response });
});

export default app;