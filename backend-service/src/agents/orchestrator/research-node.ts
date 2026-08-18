import { generateText, createUIMessageStream, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { retrieveRelevantChunks } from "../retrieval";
import { buildResearchAgentSystemPrompt } from "../prompts";
import { submitAnswerTool, extractGroundedAnswer, stopWhenAnswerAccepted } from "../tools/submit-answer";
import { toUserFacingErrorMessage } from "../../utils/provider-errors";
import { appendMessage } from "../../db/repositories/chat-history";

const FALLBACK_ANSWER = "Xin lỗi, tôi chưa thể xác nhận đủ độ tin cậy cho câu trả lời này — bạn thử hỏi lại theo cách khác giúp tôi nhé.";

export async function researchNode(state: { userId: string; message: string; history?: ModelMessage[] }) {
  const { context, sources, contentsByDocumentId } = await retrieveRelevantChunks(state.message, state.userId);

  // toolChoice ép gọi submitAnswer — xem submit-answer.ts để biết vì sao. stopWhen kết hợp 2 điều
  // kiện (mảng = dừng khi 1 trong 2 đúng): stopWhenAnswerAccepted dừng NGAY khi đã có câu trả lời
  // được chấp nhận (tránh lãng phí — xem giải thích tại định nghĩa hàm), stepCountIs(3) là chặn
  // trên an toàn nếu model cứ bị từ chối liên tục.
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

// Bản streaming của researchNode — dùng khi route là "research" thuần (không cần action theo
// sau), trả lời trực tiếp dạng streaming kèm trích nguồn.
export async function streamResearchAnswer(state: {
  userId: string;
  message: string;
  conversationId: string;
  history: ModelMessage[];
}) {
  const { context, sources, contentsByDocumentId } = await retrieveRelevantChunks(state.message, state.userId);

  return createUIMessageStream({
    execute: async ({ writer }) => {
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
      const text = grounded?.answer ?? FALLBACK_ANSWER;

      // Chỉ hiện "Nguồn" cho đúng documentId THỰC SỰ được model trích (citedDocumentIds đã qua
      // kiểm tra) — KHÔNG phải mọi tài liệu trong `sources` (đó chỉ là ứng viên được truy xuất,
      // chưa chắc được dùng). Phải ghi ở ĐÂY, sau khi có kết quả, không phải trước khi gọi model —
      // nếu ghi trước sẽ không biết được cái nào thực sự dùng, dẫn tới hiện cả tài liệu không liên
      // quan, kể cả khi model từ chối trả lời vì không tìm thấy thông tin gì.
      const citedIds = new Set(grounded?.citedDocumentIds ?? []);
      for (const s of sources) {
        if (!citedIds.has(s.documentId)) continue;
        writer.write({ type: "source-document", sourceId: s.documentId, mediaType: "text/plain", title: s.fileName, filename: s.fileName });
      }

      // Không còn text-delta từng token thật (câu trả lời nằm trong tool call, không phải text
      // tự do) — ghi thẳng 1 khối text hoàn chỉnh theo đúng protocol UIMessageChunk, để FE hiển
      // thị y hệt 1 tin nhắn text bình thường, không cần đổi gì ở page.tsx.
      writer.write({ type: "text-start", id: "grounded-answer" });
      writer.write({ type: "text-delta", id: "grounded-answer", delta: text });
      writer.write({ type: "text-end", id: "grounded-answer" });

      // .catch() bắt buộc — xem giải thích trong action-node.ts's streamActionAnswer.
      appendMessage(state.userId, state.conversationId, "assistant", text).catch((err) =>
        console.error("[research-node] Lỗi khi lưu tin nhắn assistant:", err)
      );
    },
    // Gemini quá tải/hết hạn mức (lỗi tạm thời của provider) không được rơi xuống thành lỗi 500
    // chung — user cần biết ĐÂY LÀ TẠM THỜI, nên thử lại sau, không phải lỗi hệ thống.
    onError: toUserFacingErrorMessage,
  });
}
