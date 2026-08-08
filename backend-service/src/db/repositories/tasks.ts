import { tasks } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withUserContext } from "../context";

export async function createTask(userId: string, title: string) {
  const [created] = await withUserContext(userId, (tx) =>
    tx.insert(tasks).values({ userId, title }).returning()
  );
  return created;
}

export async function listTasks(userId: string, onlyPending?: boolean) {
  return withUserContext(userId, (tx) =>
    tx
      .select({ id: tasks.id, title: tasks.title, isDone: tasks.isDone })
      .from(tasks)
      .where(onlyPending ? and(eq(tasks.userId, userId), eq(tasks.isDone, false)) : eq(tasks.userId, userId))
  );
}
