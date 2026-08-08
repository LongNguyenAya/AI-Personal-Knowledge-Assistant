import { Hono } from "hono";
import { runActionAgent } from "../agents/action-agent";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.post("/agent/action", async (c) => {
  const userId = c.get("userId");
  const { message } = await c.req.json();

  const result = await runActionAgent(message, userId);
  return result.toUIMessageStreamResponse();
});

export default app;
