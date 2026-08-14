import { getActivePrompt } from "../db/repositories/agent-prompts";
import { findRelevantApprovedNotes } from "../db/repositories/knowledge";
import { embedText } from "../utils/embedding";

export async function buildResearchAgentSystemPrompt(context: string) {
  const { systemPrompt } = await getActivePrompt("research");
  return systemPrompt.replaceAll("{{context}}", context);
}

export async function buildActionAgentSystemPrompt(currentDateUtc: string, userMessage: string) {
  const { systemPrompt } = await getActivePrompt("action");
  const currentDateVn = new Date(currentDateUtc).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "full",
    timeStyle: "medium",
  });

  // 1 lệnh gọi embedding (rẻ hơn hẳn 1 bước tool-calling generateContent) mỗi tin nhắn action agent
  // — kết quả đưa thẳng vào prompt, không qua tool đọc riêng như thiết kế ban đầu. Xem
  // findRelevantApprovedNotes (db/repositories/knowledge.ts) để biết vì sao không lọc theo ngưỡng
  // khoảng cách cứng.
  const queryEmbedding = await embedText(userMessage);
  const relevantNotes = await findRelevantApprovedNotes(queryEmbedding);
  const knowledgeContext =
    relevantNotes.length === 0
      ? "(chưa có ghi chú kiến thức nào liên quan)"
      : relevantNotes.map((n) => `### [${n.path}] ${n.title}\n${n.content}`).join("\n\n");

  return systemPrompt
    .replaceAll("{{currentDateUtc}}", currentDateUtc)
    .replaceAll("{{currentDateVn}}", currentDateVn)
    .replaceAll("{{knowledgeContext}}", knowledgeContext);
}

export async function buildRouterPrompt(message: string) {
  const { systemPrompt } = await getActivePrompt("orchestrator");
  return systemPrompt.replaceAll("{{message}}", message);
}
