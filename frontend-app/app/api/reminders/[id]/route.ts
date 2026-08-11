import { reminders } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

const PATCHABLE_FIELDS = ["title", "content", "dueAt"] as const;

export const PATCH = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const { id } = params;
  const body = await req.json();

  const patch: Record<string, unknown> = {};
  for (const key of PATCHABLE_FIELDS) {
    if (!(key in body)) continue;

    if (key === "title") {
      if (typeof body.title !== "string" || body.title.trim().length === 0) {
        return new Response("Tiêu đề không hợp lệ", { status: 400 });
      }
      patch.title = body.title.trim();
    } else if (key === "dueAt") {
      const parsedDueAt = new Date(body.dueAt);
      if (Number.isNaN(parsedDueAt.getTime())) {
        return new Response("Thời gian không hợp lệ", { status: 400 });
      }
      patch.dueAt = parsedDueAt;
    } else {
      patch.content = body.content;
    }
  }
  if (Object.keys(patch).length === 0) {
    return new Response("No valid fields to update", { status: 400 });
  }

  const [updated] = await tx.update(reminders).set(patch)
    .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)))
    .returning();

  if (!updated) return new Response("Not Found", { status: 404 });
  return Response.json(updated);
});

export const DELETE = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const { id } = params;
  const [deleted] = await tx.delete(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, session.user.id)))
    .returning({ id: reminders.id });

  if (!deleted) return new Response("Not Found", { status: 404 });
  return Response.json({ success: true });
});
