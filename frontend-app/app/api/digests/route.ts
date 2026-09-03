import { weeklyDigests } from "@ai-assistant/db/src/schema";
import { desc, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

// Chỉ đọc, digest được tạo bởi digest-worker.ts, không có POST/DELETE ở đây.
export const GET = withAuthedContext(async (_req, { session, tx }) => {
  const list = await tx
    .select({
      id: weeklyDigests.id,
      weekStart: weeklyDigests.weekStart,
      weekEnd: weeklyDigests.weekEnd,
      summaryText: weeklyDigests.summaryText,
      stats: weeklyDigests.stats,
      createdAt: weeklyDigests.createdAt,
    })
    .from(weeklyDigests)
    .where(eq(weeklyDigests.userId, session.user.id))
    .orderBy(desc(weeklyDigests.weekStart));

  return Response.json(list);
});
