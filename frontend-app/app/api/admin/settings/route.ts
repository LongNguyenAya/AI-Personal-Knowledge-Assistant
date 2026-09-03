import { systemSettings } from "@ai-assistant/db/src/schema";
import { withAdminContext } from "@/lib/with-admin-context";
import { SETTINGS_REGISTRY } from "@ai-assistant/shared-types";

// Gộp SETTINGS_REGISTRY cố định trong code với giá trị đang override trong DB, trả đủ 1 lần cho trang /admin/settings vẽ form.
export const GET = withAdminContext(async (_req, { db }) => {
  const rows = await db.select().from(systemSettings);
  const byKey = new Map(rows.map((r) => [r.key, r]));

  const settings = Object.entries(SETTINGS_REGISTRY).map(([key, meta]) => {
    const row = byKey.get(key);
    const parsed = row ? Number(row.value) : NaN;
    return {
      key,
      ...meta,
      value: Number.isFinite(parsed) ? parsed : meta.default,
      updatedAt: row?.updatedAt ?? null,
    };
  });

  return Response.json(settings);
});
