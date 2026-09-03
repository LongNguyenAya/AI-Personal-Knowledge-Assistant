import { chatHistory } from "@ai-assistant/db/src/schema";
import { eq, asc } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

// Không cần tự check conversationId thuộc đúng user không, RLS trên chat_history đã tự giới hạn theo session.
export const GET = withAuthedContext<{ id: string }>(async (req, { tx, params }) => {
  const rows = await tx
    .select({
      role: chatHistory.role,
      content: chatHistory.content,
      toolResults: chatHistory.toolResults,
      createdAt: chatHistory.createdAt,
    })
    .from(chatHistory)
    .where(eq(chatHistory.conversationId, params.id))
    .orderBy(asc(chatHistory.createdAt));

  return Response.json(rows);
});
