import { generateText, streamText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { createReminderTool } from "../tools/create-reminder";
import { searchDocumentsTool } from "../tools/search-documents";
import { createTaskTool } from "../tools/create-task";
import { listTasksTool } from "../tools/list-tasks";
import { createChartTool } from "../tools/create-chart";
import { proposeKnowledgeNoteTool } from "../tools/propose-knowledge-note";
import { extractActionItemsTool } from "../tools/extract-action-items";
import { readFullDocumentsTool } from "../tools/read-full-documents";
import { noteObservationTool } from "../tools/note-observation";
import { createDiagramTool } from "../tools/create-diagram";
import { queryKnowledgeGraphTool } from "../tools/query-knowledge-graph";
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
    extractActionItems: extractActionItemsTool(userId),
    readFullDocuments: readFullDocumentsTool(userId),
    noteObservation: noteObservationTool(userId),
    createDiagram: createDiagramTool(),
    queryKnowledgeGraph: queryKnowledgeGraphTool(userId),
  };
}

// The non-streaming version, used for the "both" route (research first, action after).
export async function actionNode(state: typeof OrchestratorState.State) {
  const contextHint = state.researchResult
    ? `\n\nThông tin đã tra cứu được trước đó: ${state.researchResult}`
    : "";

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    system: (await buildActionAgentSystemPrompt(new Date().toISOString(), state.message, state.userId)) + contextHint,
    prompt: state.message,
    tools: buildActionTools(state.userId),
    stopWhen: stepCountIs(5),
    telemetry: { functionId: "action-node" },
  });

  return { actionResult: text };
}

// The streaming version of actionNode, used as the final answering step, uses researchResult as context if present.
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
    system: (await buildActionAgentSystemPrompt(new Date().toISOString(), state.message, state.userId)) + contextHint,
    messages: [...state.history, { role: "user", content: state.message }],
    tools: buildActionTools(state.userId),
    stopWhen: stepCountIs(5),
    telemetry: { functionId: "action-node-stream" },
    onFinish: ({ text, toolResults }) => {
      // Stored alongside the tool call's input/output to rebuild UI parts and show the trace when reloading history.
      const persistedToolResults = toolResults
        .filter((r) => r.type === "tool-result")
        .map((r) => ({ toolName: r.toolName, input: r.input, output: r.output }));

      // .catch() is mandatory, see the explanation in research-node.ts streamResearchAnswer.
      appendMessage(state.userId, state.conversationId, "assistant", text, persistedToolResults).catch((err) =>
        console.error("[action-node] Lỗi khi lưu tin nhắn assistant:", err)
      );
    },
  });
}
