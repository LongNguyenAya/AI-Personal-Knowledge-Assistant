import { tasks } from "@ai-assistant/db/src/schema";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const GET = withAuthedContext(async (req, { session, tx }) => {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  const ownedNotDeleted = and(eq(tasks.userId, session.user.id), isNull(tasks.deletedAt));

  const [list, [{ total }]] = await Promise.all([
    tx.select().from(tasks)
      .where(ownedNotDeleted)
      .orderBy(desc(tasks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    tx.select({ total: count() }).from(tasks).where(ownedNotDeleted),
  ]);

  return Response.json({ tasks: list, total, page, pageSize });
});

export const POST = withAuthedContext(async (req, { session, tx }) => {
  const { title } = await req.json();
  if (typeof title !== "string" || title.trim().length === 0) {
    return new Response("Thiếu tiêu đề task", { status: 400 });
  }

  const [created] = await tx.insert(tasks).values({
    userId: session.user.id,
    title: title.trim(),
  }).returning();

  return Response.json(created);
});
