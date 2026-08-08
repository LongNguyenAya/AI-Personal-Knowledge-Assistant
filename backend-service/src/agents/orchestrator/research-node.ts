import { generateText, streamText, createUIMessageStream } from "ai";
import type { ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { retrieveRelevantChunks } from "../retrieval";
import { RESEARCH_AGENT_SYSTEM_PROMPT } from "../prompts";
import { appendMessage } from "../../db/repositories/chat-history";

export async function researchNode(state: { userId: string; message: string; history?: ModelMessage[] }) {
  const { context } = await retrieveRelevantChunks(state.message, state.userId);

  const { text } = await generateText({
    model: google("gemini-flash-latest"),
    system: RESEARCH_AGENT_SYSTEM_PROMPT(context),
    messages: [...(state.history ?? []), { role: "user", content: state.message }],
  });

  return { researchResult: text };
}

// Biến thể streaming của researchNode — dùng khi route quyết định là "research" thuần
// (không cần action theo sau), để trả lời trực tiếp cho user dạng streaming + trích nguồn,
// thay vì generateText() không streaming rồi nhét vào state cho bước action tiếp theo.
export async function streamResearchAnswer(state: {
  userId: string;
  message: string;
  conversationId: string;
  history: ModelMessage[];
}) {
  const { context, sources } = await retrieveRelevantChunks(state.message, state.userId);

  return createUIMessageStream({
    execute: ({ writer }) => {
      for (const s of sources) {
        writer.write({ type: "source-document", sourceId: s.documentId, mediaType: "text/plain", title: s.fileName, filename: s.fileName });
      }

      const result = streamText({
        model: google("gemini-flash-latest"),
        system: RESEARCH_AGENT_SYSTEM_PROMPT(context),
        messages: [...state.history, { role: "user", content: state.message }],
        onFinish: ({ text }) => {
          appendMessage(state.userId, state.conversationId, "assistant", text);
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });
}
