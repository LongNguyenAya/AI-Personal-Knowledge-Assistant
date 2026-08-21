import { getActivePrompt } from "../db/repositories/agent-prompts";
import { findRelevantApprovedNotes } from "../db/repositories/knowledge";
import { listDocuments } from "../db/repositories/documents";
import { embedText } from "../utils/embedding";

export async function buildResearchAgentSystemPrompt(context: string) {
  const { systemPrompt } = await getActivePrompt("research");
  return systemPrompt.replaceAll("{{context}}", context);
}

export async function buildActionAgentSystemPrompt(currentDateUtc: string, userMessage: string, userId: string) {
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

  // Đưa thẳng fileName+id vào prompt để model tự đối chiếu (ngữ nghĩa) tên user nhắc tới với đúng
  // id, thay vì thêm 1 lệnh gọi embedding riêng cho việc này — số tài liệu/user còn nhỏ nên liệt kê
  // thẳng là đủ, rẻ hơn (xem lý do so sánh trong plan tính năng extractActionItems).
  const docs = await listDocuments(userId);
  const documentList =
    docs.length === 0
      ? "(user chưa có tài liệu nào)"
      : docs.map((d) => `- id: ${d.id} | tên file: ${d.fileName}`).join("\n");

  return systemPrompt
    .replaceAll("{{currentDateUtc}}", currentDateUtc)
    .replaceAll("{{currentDateVn}}", currentDateVn)
    .replaceAll("{{knowledgeContext}}", knowledgeContext)
    .replaceAll("{{documentList}}", documentList);
}

export async function buildRouterPrompt(message: string) {
  const { systemPrompt } = await getActivePrompt("orchestrator");
  return systemPrompt.replaceAll("{{message}}", message);
}
