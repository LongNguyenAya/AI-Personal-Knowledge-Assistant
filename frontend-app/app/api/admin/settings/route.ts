import { systemSettings } from "@ai-assistant/db/src/schema";
import { withAdminContext } from "@/lib/with-admin-context";
import { SETTINGS_REGISTRY } from "@ai-assistant/shared-types";

// Merges the fixed SETTINGS_REGISTRY in code with the values currently overridden in the DB, returns everything at once for /admin/settings to render its form.
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
