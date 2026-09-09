import { documents, chatHistory, users } from "@ai-assistant/db/src/schema";
import { and, count, eq, gte } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

// A system-wide query using dbAdmin, totalUsers is included here so the Dashboard page doesn't need to also call /api/admin/users.
export const GET = withAdminContext(async (_req, { db }) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [[totalUsersRow], [indexedDocsRow], [aiQueries24hRow]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(documents).where(eq(documents.status, "processed")),
    // role="user" counts the number of questions, not the total chat_history rows, counting assistant rows too would double the count.
    db
      .select({ n: count() })
      .from(chatHistory)
      .where(and(eq(chatHistory.role, "user"), gte(chatHistory.createdAt, since24h))),
  ]);

  return Response.json({ totalUsers: totalUsersRow.n, indexedDocs: indexedDocsRow.n, aiQueries24h: aiQueries24hRow.n });
});
