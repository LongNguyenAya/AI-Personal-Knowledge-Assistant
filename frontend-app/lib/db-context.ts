import { sql } from "drizzle-orm";
import { db } from "./db";

export async function withUserContext<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_user_id = ${userId}`);
    return fn();
  });
}