import { weeklyDigests, users, documents, tasks, conversations, reminders } from "@ai-assistant/db/src/schema";
import { and, eq, gte, lt, isNull, sql } from "drizzle-orm";
import { dbAdmin } from "../admin-client";

// digest-worker.ts chạy cho mọi user nên cần dbAdmin, bỏ qua user đã khoá/đã xoá.
export async function findActiveUsers() {
  return dbAdmin
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)));
}

// Chặn tạo trùng digest cùng tuần, cần thiết vì message trigger có thể dồn lại trong SQS.
export async function hasDigestForWeek(userId: string, weekStart: Date): Promise<boolean> {
  const [row] = await dbAdmin
    .select({ id: weeklyDigests.id })
    .from(weeklyDigests)
    .where(and(eq(weeklyDigests.userId, userId), eq(weeklyDigests.weekStart, weekStart)));
  return !!row;
}

export async function insertWeeklyDigest(data: {
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  summaryText: string;
  stats: { documentsProcessed: number; tasksCompleted: number; tasksOverdue: number; conversationsStarted: number };
}) {
  await dbAdmin.insert(weeklyDigests).values(data);
}

// Số liệu thô dùng để quyết định có đáng tạo digest và làm dữ liệu thật cho Gemini viết văn xuôi.
export async function gatherWeeklyStats(userId: string, weekStart: Date, weekEnd: Date) {
  const [documentsProcessed] = await dbAdmin
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.status, "processed"), gte(documents.updatedAt, weekStart), lt(documents.updatedAt, weekEnd)));

  const [tasksCompleted] = await dbAdmin
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isDone, true), isNull(tasks.deletedAt), gte(tasks.updatedAt, weekStart), lt(tasks.updatedAt, weekEnd)));

  // Quá hạn tính tại thời điểm chốt tuần (weekEnd), không phải lúc chạy job, để job trễ không đổi số liệu.
  const [tasksOverdue] = await dbAdmin
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .innerJoin(reminders, eq(reminders.id, tasks.reminderId))
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isDone, false),
        isNull(tasks.deletedAt),
        gte(reminders.dueAt, weekStart),
        lt(reminders.dueAt, weekEnd)
      )
    );

  const [conversationsStarted] = await dbAdmin
    .select({ count: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), gte(conversations.createdAt, weekStart), lt(conversations.createdAt, weekEnd)));

  return {
    documentsProcessed: documentsProcessed.count,
    tasksCompleted: tasksCompleted.count,
    tasksOverdue: tasksOverdue.count,
    conversationsStarted: conversationsStarted.count,
  };
}
