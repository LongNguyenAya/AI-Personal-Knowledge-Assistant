import { tasks } from "@ai-assistant/db/src/schema";
import { and, eq, isNull } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

export const PATCH = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const { id } = params;
  const { isDone } = await req.json();
  if (typeof isDone !== "boolean") {
    return new Response("Thiếu trường isDone hợp lệ", { status: 400 });
  }

  // isNull(deletedAt) — task đã xoá mềm không còn hiện ở GET, không nên sửa được nữa dù biết id.
  const [updated] = await tx.update(tasks).set({ isDone })
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .returning();

  if (!updated) return new Response("Not Found", { status: 404 });
  return Response.json(updated);
});

// Soft delete (set deletedAt) — khác reminders (hard delete), vì cột deletedAt trên tasks vốn
// đã có sẵn cho đúng việc này.
export const DELETE = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const { id } = params;
  const [deleted] = await tx.update(tasks).set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))
    .returning({ id: tasks.id });

  if (!deleted) return new Response("Not Found", { status: 404 });
  return Response.json({ success: true });
});
