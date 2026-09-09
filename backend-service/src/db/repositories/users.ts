import { users } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { dbAdmin } from "../admin-client";

// users doesn't have RLS enabled so dbAdmin here is fine, read-only, editing personalNote is handled by frontend-app itself.
export async function getPersonalNote(userId: string): Promise<string | null> {
  const [row] = await dbAdmin.select({ personalNote: users.personalNote }).from(users).where(eq(users.id, userId));
  return row?.personalNote ?? null;
}
