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

// RLS đã tự lọc theo user khi SELECT (conversation không phải của mình sẽ trả rỗng dù tồn tại
// thật trong DB) — thêm điều kiện userId tường minh ở đây là lớp phòng thủ thứ 2, không thay thế.
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
      .select({ role: chatHistory.role, content: chatHistory.content })
      .from(chatHistory)
      .where(eq(chatHistory.conversationId, conversationId))
      .orderBy(asc(chatHistory.createdAt))
  );
}

export async function appendMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string
) {
  return withUserContext(userId, (tx) =>
    tx.insert(chatHistory).values({ conversationId, userId, role, content })
  );
}
