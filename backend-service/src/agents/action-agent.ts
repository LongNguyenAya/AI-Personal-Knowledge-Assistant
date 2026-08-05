import { google } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
import { createReminderTool } from "./tools/create-reminder";
import { searchDocumentsTool } from "./tools/search-documents";
import { ACTION_AGENT_SYSTEM_PROMPT } from "./prompts";

export async function runActionAgent(message: string, userId: string) {
  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: ACTION_AGENT_SYSTEM_PROMPT(new Date().toISOString()),
    prompt: message,
    tools: {
      createReminder: createReminderTool(userId),
      searchDocuments: searchDocumentsTool(userId),
    },
    stopWhen: stepCountIs(5),
  });

  return result;
}