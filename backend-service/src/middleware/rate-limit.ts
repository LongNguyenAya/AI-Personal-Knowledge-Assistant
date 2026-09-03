import type { Context, MiddlewareHandler, Next } from "hono";
import type { AppEnv } from "../types";
import type { Bucket } from "../types/rate-limit";
import { getSettingValue } from "../db/repositories/settings";
import type { SettingKey } from "@ai-assistant/shared-types";

const buckets = new Map<string, Bucket>();

// Dọn định kỳ để Map không phình vô hạn, chỉ chạy 1 process nên không cần Redis/DB.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  },
  10 * 60 * 1000
);

// Key theo userId chứ không phải IP, request luôn đi qua frontend-app nên IP luôn là của server đó.
export function rateLimiter({
  windowMs,
  maxSettingKey,
  name,
}: {
  windowMs: number;
  maxSettingKey: SettingKey;
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

    // Đọc live mỗi request, không cache, admin tự chỉnh qua /admin/settings.
    const max = Math.round(await getSettingValue(maxSettingKey));
    if (bucket.count >= max) {
      return c.json({ error: "Bạn đang gửi quá nhanh, vui lòng thử lại sau." }, 429);
    }

    bucket.count++;
    return next();
  };
}
