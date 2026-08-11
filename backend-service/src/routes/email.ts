import { Hono } from "hono";
import { sendVerificationEmail } from "../services/email";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.post("/auth/send-verification-email", async (c) => {
  const { to, url } = await c.req.json();
  await sendVerificationEmail(to, url);
  return c.json({ success: true });
});

export default app;
