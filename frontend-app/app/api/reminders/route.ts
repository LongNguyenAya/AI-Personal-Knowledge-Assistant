import { reminders } from "@ai-assistant/db/src/schema";
import { desc, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

export const GET = withAuthedContext(async (req, { session, tx }) => {
  const list = await tx.select().from(reminders)
    .where(eq(reminders.userId, session.user.id))
    .orderBy(desc(reminders.createdAt));
  return Response.json(list);
});

export const POST = withAuthedContext(async (req, { session, tx }) => {
  const { title, content, dueAt } = await req.json();

  const [created] = await tx.insert(reminders).values({
    userId: session.user.id,
    title,
    content,
    dueAt: new Date(dueAt),
    source: "manual",
  }).returning();

  return Response.json(created);
});
