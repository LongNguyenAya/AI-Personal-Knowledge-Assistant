import { generateText, streamText, createUIMessageStream } from "ai";
import type { ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { retrieveRelevantChunks } from "../retrieval";
import { buildResearchAgentSystemPrompt } from "../prompts";
import { appendMessage } from "../../db/repositories/chat-history";

export async function researchNode(state: { userId: string; message: string; history?: ModelMessage[] }) {
  const { context } = await retrieveRelevantChunks(state.message, state.userId);

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    system: await buildResearchAgentSystemPrompt(context),
    messages: [...(state.history ?? []), { role: "user", content: state.message }],
    telemetry: { functionId: "research-node" },
  });

  return { researchResult: text };
}

// Bản streaming của researchNode — dùng khi route là "research" thuần (không cần action theo
// sau), trả lời trực tiếp dạng streaming kèm trích nguồn.
export async function streamResearchAnswer(state: {
  userId: string;
  message: string;
  conversationId: string;
  history: ModelMessage[];
}) {
  const { context, sources } = await retrieveRelevantChunks(state.message, state.userId);

  return createUIMessageStream({
    execute: async ({ writer }) => {
      for (const s of sources) {
        writer.write({ type: "source-document", sourceId: s.documentId, mediaType: "text/plain", title: s.fileName, filename: s.fileName });
      }

      const result = streamText({
        model: google("gemini-flash-lite-latest"),
        system: await buildResearchAgentSystemPrompt(context),
        messages: [...state.history, { role: "user", content: state.message }],
        telemetry: { functionId: "research-node-stream" },
        onFinish: ({ text }) => {
          // onFinish không async nên không await được, nhưng .catch() là bắt buộc — appendMessage
          // reject mà không ai bắt là unhandled rejection, Node sẽ kill cả process, sập luôn
          // scheduler và WS cho mọi user chứ không chỉ request đang lỗi.
          appendMessage(state.userId, state.conversationId, "assistant", text).catch((err) =>
            console.error("[research-node] Lỗi khi lưu tin nhắn assistant:", err)
          );
        },
      });

      // sendStart:false vì writer đã ghi source-document cho tin nhắn này trước rồi — để mặc
      // định true, toUIMessageStream() sẽ phát thêm 1 event "bắt đầu tin nhắn mới", khiến
      // frontend hiểu nhầm thành 2 bubble tách rời.
      writer.merge(result.toUIMessageStream({ sendStart: false }));
    },
  });
}
