import { tasks } from "@ai-assistant/db/src/schema";
import { and, count, desc, eq, gte, ilike, isNull, lte } from "drizzle-orm";
import { withUserContext } from "../context";
import type { ListTasksOptions } from "../../types/tasks";

// Cheap count ignoring onlyDone/from/to, only called when listTasks comes back empty. Tells apart
// "user has no tasks at all" from "has tasks, just none match this filter".
export async function countAllTasks(userId: string): Promise<number> {
  const [row] = await withUserContext(userId, (tx) =>
    tx.select({ total: count() }).from(tasks).where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)))
  );
  return row?.total ?? 0;
}

export async function createTask(userId: string, title: string) {
  const [created] = await withUserContext(userId, (tx) =>
    tx.insert(tasks).values({ userId, title }).returning()
  );
  return created;
}

export async function listTasks(userId: string, options: ListTasksOptions = {}) {
  const { onlyDone, from, to } = options;
  const conditions = [eq(tasks.userId, userId), isNull(tasks.deletedAt)];
  if (onlyDone !== undefined) conditions.push(eq(tasks.isDone, onlyDone));

  // Filters by updatedAt when asking about completed tasks, otherwise filters by createdAt.
  const dateColumn = onlyDone === true ? tasks.updatedAt : tasks.createdAt;
  if (from) conditions.push(gte(dateColumn, from));
  if (to) conditions.push(lte(dateColumn, to));

  return withUserContext(userId, (tx) =>
    tx
      .select({ id: tasks.id, title: tasks.title, isDone: tasks.isDone, createdAt: tasks.createdAt, updatedAt: tasks.updatedAt })
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.createdAt))
  );
}

// ilike treats % and _ as wildcards, without escaping a task name that already contains one would match incorrectly.
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// ilike matches the exact full string, a name collision takes the most recent one, must filter isNull(deletedAt).
export async function findTaskByTitle(userId: string, title: string) {
  const [found] = await withUserContext(userId, (tx) =>
    tx
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ilike(tasks.title, escapeLikePattern(title)), isNull(tasks.deletedAt)))
      .orderBy(desc(tasks.createdAt))
      .limit(1)
  );
  return found;
}
