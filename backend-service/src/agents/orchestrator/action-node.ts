import { generateText, streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { createReminderTool } from "../tools/create-reminder";
import { searchDocumentsTool } from "../tools/search-documents";
import { createTaskTool } from "../tools/create-task";
import { listTasksTool } from "../tools/list-tasks";
import { createChartTool } from "../tools/create-chart";
import { proposeKnowledgeNoteTool } from "../tools/propose-knowledge-note";
import { buildActionAgentSystemPrompt } from "../prompts";
import { OrchestratorState } from "./state";
import { appendMessage } from "../../db/repositories/chat-history";

function buildActionTools(userId: string) {
  return {
    createReminder: createReminderTool(userId),
    searchDocuments: searchDocumentsTool(userId),
    createTask: createTaskTool(userId),
    listTasks: listTasksTool(userId),
    createChart: createChartTool(userId),
    proposeKnowledgeNote: proposeKnowledgeNoteTool(userId),
  };
}

export async function actionNode(state: typeof OrchestratorState.State) {
  const contextHint = state.researchResult
    ? `\n\nThông tin đã tra cứu được trước đó: ${state.researchResult}`
    : "";

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    system: (await buildActionAgentSystemPrompt(new Date().toISOString(), state.message)) + contextHint,
    prompt: state.message,
    tools: buildActionTools(state.userId),
    stopWhen: stepCountIs(5),
    telemetry: { functionId: "action-node" },
  });

  return { actionResult: text };
}

// Bản streaming của actionNode — dùng làm bước trả lời cuối cho user (route "action" hoặc
// "both"), lấy researchResult làm ngữ cảnh nếu có.
export async function streamActionAnswer(state: {
  userId: string;
  message: string;
  researchResult?: string;
  conversationId: string;
  history: ModelMessage[];
}) {
  const contextHint = state.researchResult
    ? `\n\nThông tin đã tra cứu được trước đó: ${state.researchResult}`
    : "";

  return streamText({
    model: google("gemini-flash-lite-latest"),
    system: (await buildActionAgentSystemPrompt(new Date().toISOString(), state.message)) + contextHint,
    messages: [...state.history, { role: "user", content: state.message }],
    tools: buildActionTools(state.userId),
    stopWhen: stepCountIs(5),
    telemetry: { functionId: "action-node-stream" },
    onFinish: ({ text, toolResults }) => {
      // Lưu kèm kết quả tool call (vd createChart) để phục dựng lại UI part khi tải lại lịch sử
      // hội thoại — không thì chart chỉ hiện được lúc đang stream trực tiếp, mất ngay khi reload.
      const persistedToolResults = toolResults
        .filter((r) => r.type === "tool-result")
        .map((r) => ({ toolName: r.toolName, output: r.output }));

      // .catch() bắt buộc — xem giải thích trong orchestrator/research-node.ts's streamResearchAnswer.
      appendMessage(state.userId, state.conversationId, "assistant", text, persistedToolResults).catch((err) =>
        console.error("[action-node] Lỗi khi lưu tin nhắn assistant:", err)
      );
    },
  });
}
