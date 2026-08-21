import { documents, chatHistory, users } from "@ai-assistant/db/src/schema";
import { and, count, eq, gte } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

// Query trên TOÀN BỘ hệ thống (mọi user) — dùng dbAdmin (bypass RLS), khác các route user thường
// chỉ thấy dữ liệu của chính mình. totalUsers ở đây để trang Dashboard (tổng quan) không cần gọi
// /api/admin/users nữa — trang đó giờ chỉ còn dành cho danh sách/quản lý user (xem app/admin/users).
export const GET = withAdminContext(async (_req, { db }) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[totalUsersRow], [indexedDocsRow], [aiQueries24hRow]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(documents).where(eq(documents.status, "processed")),
    // role="user" — đếm SỐ CÂU HỎI, không phải tổng số dòng chat_history (mỗi câu hỏi luôn kèm 1
    // dòng "assistant" trả lời, đếm cả 2 sẽ ra số gấp đôi số lượt hỏi thật).
    db
      .select({ n: count() })
      .from(chatHistory)
      .where(and(eq(chatHistory.role, "user"), gte(chatHistory.createdAt, since24h))),
  ]);

  return Response.json({ totalUsers: totalUsersRow.n, indexedDocs: indexedDocsRow.n, aiQueries24h: aiQueries24hRow.n });
});
