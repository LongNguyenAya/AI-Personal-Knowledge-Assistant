import { tasks } from "@ai-assistant/db/src/schema";
import { and, desc, eq, ilike, isNull } from "drizzle-orm";
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
      .where(
        onlyPending
          ? and(eq(tasks.userId, userId), eq(tasks.isDone, false), isNull(tasks.deletedAt))
          : and(eq(tasks.userId, userId), isNull(tasks.deletedAt))
      )
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
