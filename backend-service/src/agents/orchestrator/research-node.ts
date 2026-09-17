import { generateText, createUIMessageStream, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { retrieveRelevantChunks } from "../retrieval";
import { buildResearchAgentSystemPrompt } from "../prompts";
import { submitAnswerTool, extractGroundedAnswer, stopWhenAnswerAccepted } from "../tools/submit-answer";
import { toUserFacingErrorMessage, isRetryableProviderError, PROVIDER_OVERLOADED_MESSAGE } from "../../utils/provider-errors";
import { appendMessage } from "../../db/repositories/chat-history";

const FALLBACK_ANSWER = "Xin lỗi, tôi chưa thể xác nhận đủ độ tin cậy cho câu trả lời này, bạn thử hỏi lại theo cách khác giúp tôi nhé.";

const MAX_FALLBACK_CHUNKS = 5;

// Used when Gemini overloads midway, returning the raw retrieved chunks is still better than nothing.
function buildOverloadFallback(
  sources: { documentId: string; fileName: string }[],
  contentsByDocumentId: Map<string, string[]>
): string {
  const flat: { fileName: string; content: string }[] = [];
  for (const [documentId, contents] of contentsByDocumentId.entries()) {
    const fileName = sources.find((s) => s.documentId === documentId)?.fileName ?? "Tài liệu";
    for (const content of contents) flat.push({ fileName, content });
  }
  if (flat.length === 0) return PROVIDER_OVERLOADED_MESSAGE;

  const shown = flat.slice(0, MAX_FALLBACK_CHUNKS);
  const remaining = flat.length - shown.length;
  const body = shown.map((c) => `**${c.fileName}**\n${c.content}`).join("\n\n---\n\n");
  return (
    `${PROVIDER_OVERLOADED_MESSAGE} Trong lúc chờ, đây là ${shown.length} đoạn tài liệu liên quan đã tìm được ` +
    `(CHƯA qua AI tổng hợp hay kiểm tra, bạn tự đọc và đối chiếu):\n\n${body}` +
    (remaining > 0 ? `\n\n...và ${remaining} đoạn khác.` : "")
  );
}

export async function researchNode(state: { userId: string; message: string; history?: ModelMessage[]; documentId?: string }) {
  const { context, sources, contentsByDocumentId } = await retrieveRelevantChunks(state.message, state.userId, 15, state.documentId);

  // toolChoice forces a call to submitAnswer, stopWhen halts once there's a valid answer or the safety cap is hit.
  const result = await generateText({
    model: google("gemini-flash-lite-latest"),
    system: await buildResearchAgentSystemPrompt(context),
    messages: [...(state.history ?? []), { role: "user", content: state.message }],
    tools: { submitAnswer: submitAnswerTool(contentsByDocumentId) },
    toolChoice: { type: "tool", toolName: "submitAnswer" },
    stopWhen: [stepCountIs(3), stopWhenAnswerAccepted],
    telemetry: { functionId: "research-node" },
  });

  const researchResult = extractGroundedAnswer(result.toolResults)?.answer ?? FALLBACK_ANSWER;
  return { researchResult };
}

// The streaming version of researchNode, used when the route is pure research, answers come with citations.
export async function streamResearchAnswer(state: {
  userId: string;
  message: string;
  conversationId: string;
  history: ModelMessage[];
  documentId?: string;
}) {
  const { context, sources, contentsByDocumentId } = await retrieveRelevantChunks(state.message, state.userId, 15, state.documentId);

  return createUIMessageStream({
    execute: async ({ writer }) => {
      // If generateText errors from overload, the chunks already retrieved are still there for the fallback.
      let text: string;
      let persistedToolResults: { toolName: string; input?: unknown; output: unknown }[];
      let citedIds = new Set<string>();

      const retrievalStep = {
        toolName: "retrieveRelevantChunks",
        input: { question: state.message, documentId: state.documentId ?? null },
        output: {
          chunks: [...contentsByDocumentId.entries()].flatMap(([documentId, contents]) =>
            contents.map((content) => ({
              documentId,
              fileName: sources.find((s) => s.documentId === documentId)?.fileName ?? null,
              content,
            }))
          ),
        },
      };

      try {
        const result = await generateText({
          model: google("gemini-flash-lite-latest"),
          system: await buildResearchAgentSystemPrompt(context),
          messages: [...state.history, { role: "user", content: state.message }],
          tools: { submitAnswer: submitAnswerTool(contentsByDocumentId) },
          toolChoice: { type: "tool", toolName: "submitAnswer" },
          stopWhen: [stepCountIs(3), stopWhenAnswerAccepted],
          telemetry: { functionId: "research-node-stream" },
        });

        const grounded = extractGroundedAnswer(result.toolResults);
        text = grounded?.answer ?? FALLBACK_ANSWER;

        // The "what did the AI read" trace, keeps even rejected submitAnswer attempts to show the model correcting itself once caught.
        persistedToolResults = [
          retrievalStep,
          ...result.toolResults.filter((r) => r.type === "tool-result").map((r) => ({ toolName: r.toolName, input: r.input, output: r.output })),
        ];
        citedIds = new Set(grounded?.citedDocumentIds ?? []);
      } catch (err) {
        if (!isRetryableProviderError(err)) throw err;
        text = buildOverloadFallback(sources, contentsByDocumentId);
        // generateText errored before the model could call submitAnswer, only the chunk retrieval step is kept for the trace.
        persistedToolResults = [retrievalStep];
        // citedIds stays empty because raw chunks haven't been confirmed by AI, shouldn't show "Source" as if verified.
      }

      // Only shows "Source" for a documentId that was actually cited, written after the result, not before.
      for (const s of sources) {
        if (!citedIds.has(s.documentId)) continue;
        writer.write({ type: "source-document", sourceId: s.documentId, mediaType: "text/plain", title: s.fileName, filename: s.fileName });
      }

      // The answer lives inside the tool call, writes 1 UIMessageChunk block directly so the FE displays it like normal text.
      writer.write({ type: "text-start", id: "grounded-answer" });
      writer.write({ type: "text-delta", id: "grounded-answer", delta: text });
      writer.write({ type: "text-end", id: "grounded-answer" });

      // .catch() is mandatory, see the explanation in action-node.ts streamActionAnswer.
      appendMessage(state.userId, state.conversationId, "assistant", text, persistedToolResults).catch((err) =>
        console.error("[research-node] Lỗi khi lưu tin nhắn assistant:", err)
      );
    },
    // Gemini overload must not fall through as a generic 500, the user needs to know it's temporary and worth retrying.
    onError: toUserFacingErrorMessage,
  });
}
