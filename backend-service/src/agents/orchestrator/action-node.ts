import { generateText, streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { createReminderTool } from "../tools/create-reminder";
import { searchDocumentsTool } from "../tools/search-documents";
import { createTaskTool } from "../tools/create-task";
import { listTasksTool } from "../tools/list-tasks";
import { ACTION_AGENT_SYSTEM_PROMPT } from "../prompts";
import { OrchestratorState } from "./state";
import { appendMessage } from "../../db/repositories/chat-history";

function buildActionTools(userId: string) {
  return {
    createReminder: createReminderTool(userId),
    searchDocuments: searchDocumentsTool(userId),
    createTask: createTaskTool(userId),
    listTasks: listTasksTool(userId),
  };
}

export async function actionNode(state: typeof OrchestratorState.State) {
  // Nếu đã có researchResult từ bước trước, đưa vào làm ngữ cảnh bổ sung
  const contextHint = state.researchResult
    ? `\n\nThông tin đã tra cứu được trước đó: ${state.researchResult}`
    : "";

  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    system: ACTION_AGENT_SYSTEM_PROMPT(new Date().toISOString()) + contextHint,
    prompt: state.message,
    tools: buildActionTools(state.userId),
    stopWhen: stepCountIs(5),
  });

  return { actionResult: text };
}

// Biến thể streaming của actionNode — dùng làm bước cuối trả lời trực tiếp cho user
// (route "action" hoặc "both", với researchResult làm ngữ cảnh nếu có sẵn).
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
    model: google("gemini-flash-latest"),
    system: ACTION_AGENT_SYSTEM_PROMPT(new Date().toISOString()) + contextHint,
    messages: [...state.history, { role: "user", content: state.message }],
    tools: buildActionTools(state.userId),
    stopWhen: stepCountIs(5),
    onFinish: ({ text }) => {
      appendMessage(state.userId, state.conversationId, "assistant", text);
    },
  });
}
