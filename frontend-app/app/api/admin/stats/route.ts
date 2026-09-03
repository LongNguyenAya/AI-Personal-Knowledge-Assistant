import { documents, chatHistory, users } from "@ai-assistant/db/src/schema";
import { and, count, eq, gte } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

// Query trên toàn bộ hệ thống dùng dbAdmin, totalUsers ở đây để trang Dashboard không cần gọi /api/admin/users nữa.
export const GET = withAdminContext(async (_req, { db }) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[totalUsersRow], [indexedDocsRow], [aiQueries24hRow]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(documents).where(eq(documents.status, "processed")),
    // role="user" đếm số câu hỏi chứ không phải tổng dòng chat_history, đếm cả assistant sẽ ra số gấp đôi.
    db
      .select({ n: count() })
      .from(chatHistory)
      .where(and(eq(chatHistory.role, "user"), gte(chatHistory.createdAt, since24h))),
  ]);

  return Response.json({ totalUsers: totalUsersRow.n, indexedDocs: indexedDocsRow.n, aiQueries24h: aiQueries24hRow.n });
});
