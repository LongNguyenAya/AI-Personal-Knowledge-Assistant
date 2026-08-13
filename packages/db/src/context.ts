import { sql } from "drizzle-orm";
import { db } from "./client";

export type UserScopedTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Mở 1 transaction ngắn riêng cho mỗi lời gọi, không giữ chung 1 transaction suốt cả request —
// route streaming + tool-calling có thể ghi DB bất kỳ lúc nào giữa chừng, giữ transaction mở lâu
// dễ cạn connection pool.
//
// (sql.reserve() của postgres.js tưởng cũng giữ được 1 connection suốt request, nhưng object nó
// trả về thiếu .options mà drizzle cần, gây lỗi runtime — db.transaction() không gặp vấn đề này.)
//
// set_config() thay vì "SET LOCAL ... = $1" vì SET không nhận bind parameter. is_local=true để
// giá trị tự reset khi transaction xong, đúng như ý nghĩa của SET LOCAL.
export async function withUserContext<T>(userId: string, fn: (tx: UserScopedTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
