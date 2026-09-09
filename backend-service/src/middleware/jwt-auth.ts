import type { MiddlewareHandler } from "hono";
import { verifyBackendToken } from "../utils/backend-token";
import type { AppEnv } from "../types";

// Used for every normal HTTP route, the /ws route uses its own middleware (ws-auth.ts) for a different reason.
export const jwtAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  const userId = await verifyBackendToken(token);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  c.set("userId", userId);
  await next();
};
