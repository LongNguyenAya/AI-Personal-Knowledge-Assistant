import { documents, type DocumentStatus } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withUserContext } from "../context";

// eq(documents.userId, userId) tường minh dù RLS đã lọc rồi — cùng kiểu phòng thủ 2 lớp như ở
// chunks.ts/tasks.ts/chat-history.ts.
export async function updateStatus(userId: string, documentId: string, status: DocumentStatus) {
  return withUserContext(userId, (tx) =>
    tx.update(documents).set({ status }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
  );
}

// Dùng để đưa danh sách tên tài liệu vào system prompt (buildActionAgentSystemPrompt) — cho phép
// model tự đối chiếu tên user nhắc tới (thường mô tả theo chủ đề, không trùng khớp fileName thật)
// với đúng id, thay vì match chuỗi cứng như findTaskByTitle.
export async function listDocuments(userId: string) {
  return withUserContext(userId, (tx) =>
    tx.select({ id: documents.id, fileName: documents.fileName }).from(documents).where(eq(documents.userId, userId))
  );
}
