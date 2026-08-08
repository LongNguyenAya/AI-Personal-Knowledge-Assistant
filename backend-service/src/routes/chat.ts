import { Hono } from "hono";
import { createUIMessageStreamResponse } from "ai";
import { runResearchAgent } from "../agents/research-agent";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.post("/agent/chat", async (c) => {
  const userId = c.get("userId");
  const { message } = await c.req.json();

  const stream = await runResearchAgent(message, userId);

  return createUIMessageStreamResponse({ stream });
});

export default app;
