import { tasks } from "@ai-assistant/db/src/schema";
import { and, desc, eq, gte, ilike, isNull, lte } from "drizzle-orm";
import { withUserContext } from "../context";
import type { ListTasksOptions } from "../../types/tasks";

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

  // Lọc theo updatedAt khi hỏi task đã hoàn thành, còn lại lọc theo createdAt.
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

// ilike coi % và _ là ký tự đại diện, không escape thì tên task chứa sẵn ký tự đó sẽ khớp nhầm.
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// ilike khớp chính xác toàn chuỗi, trùng tên lấy bản mới nhất, phải lọc isNull(deletedAt).
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
