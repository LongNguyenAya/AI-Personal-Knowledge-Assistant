import type { MiddlewareHandler } from "hono";
import { jwtVerify, importJWK } from "jose";
import type { AppEnv } from "../types";

// Chỉ giữ public key — không thể dùng để tự ký token giả, chỉ verify được chữ ký do
// frontend-app (giữ private key riêng) tạo ra. Thay thế cả internal-auth.ts (secret tĩnh)
// lẫn user-context.ts (tin thẳng header X-User-Id không xác minh) trước đây.
const publicKeyPromise = importJWK(JSON.parse(process.env.JWT_PUBLIC_KEY!), "EdDSA");

export const jwtAuthMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
  if (!token) return c.json({ error: "Unauthorized" }, 401);

  try {
    const publicKey = await publicKeyPromise;
    const { payload } = await jwtVerify(token, publicKey);
    if (typeof payload.sub !== "string") return c.json({ error: "Unauthorized" }, 401);
    c.set("userId", payload.sub);
  } catch {
    // Chữ ký sai, token hết hạn, hoặc format không hợp lệ — đều coi là chưa xác thực.
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
};
