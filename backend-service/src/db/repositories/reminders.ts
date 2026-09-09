import { reminders, tasks, users, type ReminderSource } from "@ai-assistant/db/src/schema";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { withUserContext } from "../context";
import { dbAdmin } from "../admin-client";

export async function createReminder(
  userId: string,
  data: { title: string; content?: string; dueAt: Date; source: ReminderSource; taskIds?: string[] }
) {
  const { taskIds, ...reminderData } = data;
  return withUserContext(userId, async (tx) => {
    const [created] = await tx.insert(reminders).values({ userId, ...reminderData }).returning();
    let relinkedFrom: string[] = [];
    if (taskIds && taskIds.length > 0) {
      // 1 task belongs to only 1 reminder, reads the old reminderId first to tell the caller which task just changed.
      const previouslyLinked = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt), sql`${tasks.reminderId} IS NOT NULL AND ${tasks.reminderId} != ${created.id}`));
      relinkedFrom = previouslyLinked.map((t) => t.id);

      await tx.update(tasks).set({ reminderId: created.id }).where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt)));
    }
    return { ...created, relinkedTaskIds: relinkedFrom };
  });
}

// Doesn't JOIN directly to tasks (would multiply rows), fetches task names via a separate query then merges with a Map.
async function attachTaskTitles<T extends { id: string }>(rows: T[]): Promise<(T & { taskTitles: string[] })[]> {
  if (rows.length === 0) return [];
  // Must filter isNull(deletedAt), otherwise the WebSocket/email push would still mention a task the user already deleted.
  const linkedTasks = await dbAdmin
    .select({ reminderId: tasks.reminderId, title: tasks.title })
    .from(tasks)
    .where(and(inArray(tasks.reminderId, rows.map((r) => r.id)), isNull(tasks.deletedAt)));

  const map = new Map<string, string[]>();
  for (const t of linkedTasks) {
    if (!t.reminderId) continue;
    map.set(t.reminderId, [...(map.get(t.reminderId) ?? []), t.title]);
  }
  return rows.map((r) => ({ ...r, taskTitles: map.get(r.id) ?? [] }));
}

// The scheduler scans all users at once, withUserContext only sees 1 user so dbAdmin has to be used.
export async function findDueReminders() {
  const due = await dbAdmin
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, "pending"), lte(reminders.dueAt, new Date())));
  return attachTaskTitles(due);
}

// Marked right after being found so the scheduler doesn't pick it up again, emailSentAt is a dedicated column.
export async function markReminderSent(reminderId: string) {
  return dbAdmin.update(reminders).set({ status: "sent" }).where(eq(reminders.id, reminderId));
}

// Scanned independently of status because the email still needs to send even if no one opens the app, joins users to get the email.
export async function findRemindersNeedingEmail() {
  const due = await dbAdmin
    .select({
      id: reminders.id,
      title: reminders.title,
      content: reminders.content,
      dueAt: reminders.dueAt,
      userEmail: users.email,
    })
    .from(reminders)
    .innerJoin(users, eq(reminders.userId, users.id))
    .where(and(isNull(reminders.emailSentAt), lte(reminders.dueAt, new Date())));
  return attachTaskTitles(due);
}

export async function markEmailSent(reminderId: string) {
  return dbAdmin.update(reminders).set({ emailSentAt: new Date() }).where(eq(reminders.id, reminderId));
}
