import type { Context, MiddlewareHandler, Next } from "hono";
import type { AppEnv } from "../types";
import type { Bucket } from "../types/rate-limit";
import { getSettingValue } from "../db/repositories/settings";
import type { SettingKey } from "@ai-assistant/shared-types";

const buckets = new Map<string, Bucket>();

// Cleaned up periodically so the Map doesn't grow unbounded, only runs in 1 process so Redis/DB isn't needed.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  },
  10 * 60 * 1000
);

// Keyed by userId, not IP, since requests always go through frontend-app the IP would always be that server's.
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

    // Read live on every request, no caching, admin adjusts it via /admin/settings.
    const max = Math.round(await getSettingValue(maxSettingKey));
    if (bucket.count >= max) {
      return c.json({ error: "Bạn đang gửi quá nhanh, vui lòng thử lại sau." }, 429);
    }

    bucket.count++;
    return next();
  };
}
