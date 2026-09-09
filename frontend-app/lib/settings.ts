import { systemSettings } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { dbAdmin } from "./db-admin";
import { SETTINGS_REGISTRY, type SettingKey } from "@ai-assistant/shared-types";

// system_settings has no RLS so it's read through dbAdmin, if an admin has never touched it there's no row, it falls back to the default in SETTINGS_REGISTRY.
export async function getSettingValue(key: SettingKey): Promise<number> {
  const [row] = await dbAdmin.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, key));
  if (!row) return SETTINGS_REGISTRY[key].default;

  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : SETTINGS_REGISTRY[key].default;
}
