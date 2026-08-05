import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { createReminderTool } from "../tools/create-reminder";
import { searchDocumentsTool } from "../tools/search-documents";
import { ACTION_AGENT_SYSTEM_PROMPT } from "../prompts";
import { OrchestratorState } from "./state";

export async function actionNode(state: typeof OrchestratorState.State) {
  // Nếu đã có researchResult từ bước trước, đưa vào làm ngữ cảnh bổ sung
  const contextHint = state.researchResult
    ? `\n\nThông tin đã tra cứu được trước đó: ${state.researchResult}`
    : "";

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: ACTION_AGENT_SYSTEM_PROMPT(new Date().toISOString()) + contextHint,
    prompt: state.message,
    tools: {
      createReminder: createReminderTool(state.userId),
      searchDocuments: searchDocumentsTool(state.userId),
    },
    stopWhen: stepCountIs(5),
  });

  return { actionResult: text };
}