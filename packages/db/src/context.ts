import { sql } from "drizzle-orm";
import { db } from "./client";

export type UserScopedTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Short dedicated transaction per call to avoid exhausting the connection pool, set_config with is_local=true auto resets when done.
export async function withUserContext<T>(userId: string, fn: (tx: UserScopedTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
