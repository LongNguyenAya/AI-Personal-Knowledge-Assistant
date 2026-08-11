import type { MiddlewareHandler } from "hono";
import { verifyBackendToken } from "../utils/backend-token";
import type { AppEnv } from "../types";

// Dùng cho mọi route HTTP thường, token nằm trong header Authorization. Route /ws dùng middleware
// riêng (ws-auth.ts) vì trình duyệt không set được header lúc nâng cấp WebSocket.
export const jwtAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const userId = await verifyBackendToken(token);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  c.set("userId", userId);
  await next();
};
