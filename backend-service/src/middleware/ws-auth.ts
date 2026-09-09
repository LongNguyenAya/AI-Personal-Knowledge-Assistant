import type { MiddlewareHandler } from "hono";
import { verifyBackendToken } from "../utils/backend-token";
import type { AppEnv } from "../types";

// The browser can't set a header during the WebSocket upgrade, so the token is passed via query string instead.
export const wsAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = c.req.query("token");
  const userId = token ? await verifyBackendToken(token) : null;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  c.set("userId", userId);
  await next();
};
