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
