import { Hono } from "hono";
import { runActionAgent } from "../agents/action-agent";

const app = new Hono();

app.post("/agent/action", async (c) => {
  const userId = c.req.header("X-User-Id");
  const { message } = await c.req.json();

  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const result = await runActionAgent(message, userId);
  return result.toUIMessageStreamResponse();
});

export default app;