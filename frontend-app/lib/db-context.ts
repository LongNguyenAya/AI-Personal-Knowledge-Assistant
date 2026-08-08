import { sql } from "drizzle-orm";
import { db } from "./db";

export type UserScopedTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// SET LOCAL không nhận bind parameter (Postgres báo lỗi cú pháp với "$1"), nên phải
// dùng set_config() — một function call bình thường, tham số hoá được như mọi query khác.
// is_local=true để giá trị tự reset khi transaction kết thúc, giống hệt ý nghĩa của SET LOCAL.
export async function withUserContext<T>(userId: string, fn: (tx: UserScopedTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}