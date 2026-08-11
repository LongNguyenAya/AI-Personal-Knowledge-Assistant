import type { MiddlewareHandler } from "hono";
import { verifyBackendToken } from "../utils/backend-token";
import type { AppEnv } from "../types";

// Trình duyệt không set được header Authorization lúc nâng cấp WebSocket, nên token (mint bởi
// GET /api/ws-token ở frontend-app) truyền qua query string thay vì header. Verify JWT giống
// hệt jwt-auth.ts.
export const wsAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = c.req.query("token");
  const userId = token ? await verifyBackendToken(token) : null;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  c.set("userId", userId);
  await next();
};
