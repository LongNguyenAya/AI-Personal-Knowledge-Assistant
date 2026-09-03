import { systemSettings } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { dbAdmin } from "../admin-client";
import { SETTINGS_REGISTRY, type SettingKey } from "@ai-assistant/shared-types";

// system_settings dùng chung không RLS, chưa từng bị chỉnh thì rơi về default trong SETTINGS_REGISTRY.
export async function getSettingValue(key: SettingKey): Promise<number> {
  const [row] = await dbAdmin.select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, key));
  if (!row) return SETTINGS_REGISTRY[key].default;

  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : SETTINGS_REGISTRY[key].default;
}
