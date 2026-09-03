import { users, tasks, reminders } from "@ai-assistant/db/src/schema";
import { count, desc, isNull } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// 3 query rời rồi merge bằng Map thay vì JOIN vì join trực tiếp sẽ fan-out, taskCounts/reminderCounts tính trên toàn bộ user.
export const GET = withAdminContext(async (req, { db }) => {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

  // Không lọc isNull(deletedAt) vì admin cần thấy cả tài khoản đã xoá mềm để khôi phục lại được.
  const [userList, [{ total }]] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(users),
  ]);

  const taskCounts = await db
    .select({ userId: tasks.userId, n: count() })
    .from(tasks)
    .where(isNull(tasks.deletedAt))
    .groupBy(tasks.userId);

  // Không lọc deletedAt vì reminders không có soft-delete, luôn hard delete, khác tasks.
  const reminderCounts = await db
    .select({ userId: reminders.userId, n: count() })
    .from(reminders)
    .groupBy(reminders.userId);

  const taskMap = new Map(taskCounts.map((r) => [r.userId, r.n]));
  const reminderMap = new Map(reminderCounts.map((r) => [r.userId, r.n]));

  return Response.json({
    users: userList.map((u) => ({
      ...u,
      taskCount: taskMap.get(u.id) ?? 0,
      reminderCount: reminderMap.get(u.id) ?? 0,
    })),
    total,
    page,
    pageSize,
  });
});
