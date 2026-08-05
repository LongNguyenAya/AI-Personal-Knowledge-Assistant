import { Hono } from "hono";
import { runResearchAgent } from "../agents/research-agent";

const app = new Hono();

app.post("/agent/chat", async (c) => {
  const userId = c.req.header("X-User-Id");
  const { message } = await c.req.json();

  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const result = await runResearchAgent(message, userId);

  return result.toUIMessageStreamResponse();
});

export default app;