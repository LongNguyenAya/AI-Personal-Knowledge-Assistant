import { users } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { dbAdmin } from "../admin-client";

// users không bật RLS nên dbAdmin ở đây bình thường, chỉ đọc, sửa personalNote do frontend-app tự làm.
export async function getPersonalNote(userId: string): Promise<string | null> {
  const [row] = await dbAdmin.select({ personalNote: users.personalNote }).from(users).where(eq(users.id, userId));
  return row?.personalNote ?? null;
}
