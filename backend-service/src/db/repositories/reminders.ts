import { reminders, reminderSourceEnum, tasks, users } from "@ai-assistant/db/src/schema";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { withUserContext } from "../context";
import { dbAdmin } from "../admin-client";

type ReminderSource = (typeof reminderSourceEnum.enumValues)[number];

export async function createReminder(
  userId: string,
  data: { title: string; content?: string; dueAt: Date; source: ReminderSource; taskIds?: string[] }
) {
  const { taskIds, ...reminderData } = data;
  return withUserContext(userId, async (tx) => {
    const [created] = await tx.insert(reminders).values({ userId, ...reminderData }).returning();
    // Gán reminderId cho các task được liên kết.
    let relinkedFrom: string[] = [];
    if (taskIds && taskIds.length > 0) {
      // 1 task chỉ thuộc được 1 reminder tại 1 thời điểm — đọc trước reminderId cũ để báo lại
      // cho caller biết task nào vừa bị "cướp" khỏi reminder trước, tránh ghi đè âm thầm.
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

// Không JOIN trực tiếp sang tasks (1 reminder nhiều task sẽ nhân dòng) — lấy tên task qua query
// riêng rồi merge bằng Map, giống cách đã làm ở admin/users.
async function attachTaskTitles<T extends { id: string }>(rows: T[]): Promise<(T & { taskTitles: string[] })[]> {
  if (rows.length === 0) return [];
  // Phải lọc isNull(deletedAt), không thì push WebSocket/email vẫn nhắc tên task user đã xoá.
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

// Scheduler quét reminder tới hạn của tất cả user cùng lúc, withUserContext chỉ thấy 1 user
// nên phải dùng dbAdmin.
export async function findDueReminders() {
  const due = await dbAdmin
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, "pending"), lte(reminders.dueAt, new Date())));
  return attachTaskTitles(due);
}

// Đánh dấu ngay sau khi tìm thấy, tránh scheduler quét trúng reminder này lần nữa ở lượt sau.
// emailSentAt là cột riêng, không đụng ở đây.
export async function markReminderSent(reminderId: string) {
  return dbAdmin.update(reminders).set({ status: "sent" }).where(eq(reminders.id, reminderId));
}

// Quét độc lập với status (status có thể đã đổi "sent" từ nhánh WebSocket rồi) — email vẫn cần
// gửi kể cả khi không ai mở app lúc tới hạn. Join sang users luôn để lấy email nhận.
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
