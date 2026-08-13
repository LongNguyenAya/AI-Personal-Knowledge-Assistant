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

  // Lọc theo updatedAt khi hỏi cụ thể task ĐÃ hoàn thành (mốc hoàn thành đáng tin — xem lý do ở
  // analytics.ts), còn lại lọc theo createdAt vì task chưa hoàn thành không có mốc hoàn thành nào.
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

// ilike coi % và _ là ký tự đại diện (khớp nhiều ký tự / đúng 1 ký tự) — nếu không escape, tên
// task chứa sẵn "%" hay "_" (khá thường gặp, vd "Update_docs") sẽ vô tình khớp nhầm task khác
// ("UpdateXdocs") thay vì chỉ khớp đúng chuỗi đó.
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// ilike khớp chính xác toàn chuỗi (không phân biệt hoa thường), không phải substring — tránh
// nhầm "Viết báo cáo tháng 1" với "tháng 2". Trùng tên thì lấy bản mới nhất.
// Phải lọc isNull(deletedAt), không thì reminder mới có thể hồi sinh liên kết cho task user đã xoá.
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
