import { conversations, chatHistory } from "@ai-assistant/db/src/schema";
import { eq, and, asc, desc, isNull } from "drizzle-orm";
import { withUserContext } from "../context";

const TITLE_MAX_WORDS = 6;

// Lấy vài từ đầu câu hỏi làm tiêu đề, không gọi AI, đủ để phân biệt các cuộc trò chuyện.
function deriveTitle(rawMessage: string): string {
  const words = rawMessage.trim().split(/\s+/);
  if (words.length <= TITLE_MAX_WORDS) return words.join(" ");
  return words.slice(0, TITLE_MAX_WORDS).join(" ") + "...";
}

// WHERE title IS NULL vừa là điều kiện đặt tên lần đầu, vừa tự chống ghi đè khi gọi lại.
export async function setConversationTitleIfEmpty(userId: string, conversationId: string, rawMessage: string): Promise<void> {
  const title = deriveTitle(rawMessage);
  await withUserContext(userId, (tx) =>
    tx
      .update(conversations)
      .set({ title })
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId), isNull(conversations.title)))
  );
}

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

// RLS đã tự lọc theo user rồi, vẫn thêm điều kiện userId tường minh làm lớp phòng thủ thứ 2.
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
  toolResults?: { toolName: string; input?: unknown; output: unknown }[]
) {
  return withUserContext(userId, (tx) =>
    tx.insert(chatHistory).values({
      conversationId,
      userId,
      role,
      content,
      // Mảng rỗng thì lưu null thay vì [], tránh nhầm "không gọi tool" với "gọi tool nhưng rỗng kết quả".
      toolResults: toolResults && toolResults.length > 0 ? toolResults : null,
    })
  );
}
