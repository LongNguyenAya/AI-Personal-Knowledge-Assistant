import { documents, type DocumentStatus } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withUserContext } from "../context";

// Lọc userId tường minh dù RLS đã lọc rồi, cùng kiểu phòng thủ 2 lớp như các repo khác.
export async function updateStatus(userId: string, documentId: string, status: DocumentStatus) {
  return withUserContext(userId, (tx) =>
    tx.update(documents).set({ status }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
  );
}

// Ghi lại kết quả quét injection, không chặn xử lý, chỉ đánh dấu để cảnh báo UI và hạ confidence.
export async function flagSuspicious(userId: string, documentId: string, reason: string) {
  return withUserContext(userId, (tx) =>
    tx.update(documents).set({ flaggedSuspicious: true, flagReason: reason }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
  );
}

// Đưa danh sách tên tài liệu vào system prompt để model tự đối chiếu tên user nhắc tới với đúng id.
export async function listDocuments(userId: string) {
  return withUserContext(userId, (tx) =>
    tx.select({ id: documents.id, fileName: documents.fileName }).from(documents).where(eq(documents.userId, userId))
  );
}
