import { sql } from "drizzle-orm";
import { db } from "./client";

export type UserScopedTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Mỗi lời gọi mở 1 transaction ngắn riêng cho đúng 1 (hoặc vài) câu query liên quan —
// KHÔNG giữ 1 transaction/connection dùng chung suốt cả request, vì các route ở đây trả
// về streaming response và tool-calling có thể ghi DB bất kỳ lúc nào giữa lúc đang stream;
// giữ transaction mở suốt thời gian đó sẽ dễ cạn connection pool.
// (Đã thử dùng postgres.js's sql.reserve() để có 1 connection sống suốt request — không dùng
// được vì drizzle-orm's construct() ghi thẳng vào client.options.parsers, mà object trả về từ
// reserve() không có .options, nên throw runtime error. db.transaction() không có vấn đề này.)
// set_config() dùng thay cho "SET LOCAL ... = $1" vì SET không nhận bind parameter.
export async function withUserContext<T>(userId: string, fn: (tx: UserScopedTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);
    return fn(tx);
  });
}
