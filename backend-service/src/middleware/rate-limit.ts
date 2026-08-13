import type { Context, MiddlewareHandler, Next } from "hono";
import type { AppEnv } from "../types";
import type { Bucket } from "../types/rate-limit";

const buckets = new Map<string, Bucket>();

// Dọn định kỳ để Map không phình vô hạn — backend-service chỉ chạy 1 process nên Map in-memory
// là đủ, không cần Redis/DB cho việc này. Mất dữ liệu khi restart là chấp nhận được.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  },
  10 * 60 * 1000
);

// Key theo userId chứ không phải IP — request tới backend-service đều đi qua frontend-app theo
// kiểu server-to-server, nên IP nhìn thấy luôn là IP của server đó, không phân biệt được user nào.
export function rateLimiter({
  windowMs,
  max,
  name,
}: {
  windowMs: number;
  max: number;
  name: string;
}): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next: Next) => {
    const userId = c.get("userId");
    const key = `${name}:${userId}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      return c.json({ error: "Bạn đang gửi quá nhanh, vui lòng thử lại sau." }, 429);
    }

    bucket.count++;
    return next();
  };
}
