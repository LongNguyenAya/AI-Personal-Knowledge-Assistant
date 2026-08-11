import { reminders } from "@ai-assistant/db/src/schema";
import { count, desc, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const GET = withAuthedContext(async (req, { session, tx }) => {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  const [list, [{ total }]] = await Promise.all([
    tx.select().from(reminders)
      .where(eq(reminders.userId, session.user.id))
      .orderBy(desc(reminders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    tx.select({ total: count() }).from(reminders).where(eq(reminders.userId, session.user.id)),
  ]);

  return Response.json({ reminders: list, total, page, pageSize });
});

export const POST = withAuthedContext(async (req, { session, tx }) => {
  const { title, content, dueAt } = await req.json();

  if (typeof title !== "string" || title.trim().length === 0) {
    return new Response("Thiếu tiêu đề reminder", { status: 400 });
  }
  const parsedDueAt = new Date(dueAt);
  if (Number.isNaN(parsedDueAt.getTime())) {
    return new Response("Thời gian không hợp lệ", { status: 400 });
  }

  const [created] = await tx.insert(reminders).values({
    userId: session.user.id,
    title: title.trim(),
    content,
    dueAt: parsedDueAt,
    source: "manual",
  }).returning();

  return Response.json(created);
});
