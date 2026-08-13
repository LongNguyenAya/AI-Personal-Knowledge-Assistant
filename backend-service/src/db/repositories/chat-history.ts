import { conversations, chatHistory } from "@ai-assistant/db/src/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { withUserContext } from "../context";

export async function createConversation(userId: string) {
  const [created] = await withUserContext(userId, (tx) =>
    tx.insert(conversations).values({ userId }).returning()
  );
  return created;
}

export async function getLatestConversation(userId: string) {
  const [existing] = await withUserContext(userId, (tx) =>
    tx.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.createdAt)).limit(1)
  );
  return existing ?? null;
}

// RLS đã tự lọc theo user rồi (SELECT conversation của người khác sẽ trả rỗng), nhưng vẫn thêm
// điều kiện userId tường minh ở đây làm lớp phòng thủ thứ 2.
export async function assertConversationOwnership(userId: string, conversationId: string): Promise<boolean> {
  const [row] = await withUserContext(userId, (tx) =>
    tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1)
  );
  return !!row;
}

export async function listMessages(userId: string, conversationId: string) {
  return withUserContext(userId, (tx) =>
    tx
      .select({ role: chatHistory.role, content: chatHistory.content, toolResults: chatHistory.toolResults })
      .from(chatHistory)
      .where(eq(chatHistory.conversationId, conversationId))
      .orderBy(asc(chatHistory.createdAt))
  );
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  toolResults?: { toolName: string; output: unknown }[]
) {
  return withUserContext(userId, (tx) =>
    tx.insert(chatHistory).values({
      conversationId,
      userId,
      role,
      content,
      // Mảng rỗng thì lưu null thay vì [] — tin nhắn không gọi tool nào nên không có gì để phục
      // dựng lại, tránh phân biệt nhầm "không gọi tool" với "gọi tool nhưng rỗng kết quả".
      toolResults: toolResults && toolResults.length > 0 ? toolResults : null,
    })
  );
}
