import { Hono } from "hono";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { runOrchestrator } from "../agents/orchestrator";
import { routerNode } from "../agents/orchestrator/router-node";
import { researchNode, streamResearchAnswer } from "../agents/orchestrator/research-node";
import { streamActionAnswer } from "../agents/orchestrator/action-node";
import { isRetryableProviderError, toUserFacingErrorMessage, PROVIDER_OVERLOADED_MESSAGE } from "../utils/provider-errors";
import {
  getLatestConversation,
  createConversation,
  assertConversationOwnership,
  listMessages,
  appendMessage,
  setConversationTitleIfEmpty,
} from "../db/repositories/chat-history";
import { rateLimiter } from "../middleware/rate-limit";
import type { AppEnv } from "../types";

// researchNode() nhánh both không chạy trong stream, lỗi provider tạm thời thì tự dựng UI message stream.
function overloadedResponse() {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id: "overloaded" });
        writer.write({ type: "text-delta", id: "overloaded", delta: PROVIDER_OVERLOADED_MESSAGE });
        writer.write({ type: "text-end", id: "overloaded" });
      },
    }),
  });
}

const app = new Hono<AppEnv>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dùng chung 1 cặp bucket cho cả 2 endpoint để không cho user lách giới hạn qua endpoint debug.
const chatPerMinute = rateLimiter({ windowMs: 60 * 1000, maxSettingKey: "chatPerMinuteLimit", name: "chat-minute" });
const chatPerDay = rateLimiter({ windowMs: 24 * 60 * 60 * 1000, maxSettingKey: "chatPerDayLimit", name: "chat-day" });

// Endpoint gốc không streaming, giữ lại để test nhanh qua Postman, cố ý không có lịch sử hội thoại.
app.post("/agent/orchestrate", chatPerMinute, chatPerDay, async (c) => {
  const userId = c.get("userId");
  const { message } = await c.req.json();

  const response = await runOrchestrator(message, userId);
  return c.json({ response });
});

// Endpoint streaming dùng bởi chat UI thật, router quyết định route trước rồi mới stream câu trả lời.
app.post("/agent/orchestrate/stream", chatPerMinute, chatPerDay, async (c) => {
  const userId = c.get("userId");
  const { message, conversationId: requestedConversationId, attachedDocumentId } = await c.req.json();

  // frontend-app quyết định conversation nào đang active, ở đây chỉ xác minh nó thuộc về user này.
  let conversationId: string;
  if (requestedConversationId) {
    // Validate format trước khi query, chuỗi không phải UUID sẽ khiến Postgres ném lỗi 500 thay vì 400.
    if (!UUID_RE.test(requestedConversationId)) {
      return c.json({ error: "Invalid conversationId" }, 400);
    }
    const owns = await assertConversationOwnership(userId, requestedConversationId);
    if (!owns) return c.json({ error: "Invalid conversationId" }, 400);
    conversationId = requestedConversationId;
  } else {
    const latest = await getLatestConversation(userId);
    conversationId = latest ? latest.id : (await createConversation(userId)).id;
  }

  // Lưu tin nhắn user ngay trước khi xử lý, model lỗi giữa chừng thì tin nhắn vẫn không mất.
  const priorMessages = await listMessages(userId, conversationId);

  // Model không thấy lại dữ liệu thật của chart cũ, chèn thêm dữ liệu vào đúng tin nhắn chart gần nhất.
  let lastChartMessageIndex = -1;
  for (let i = priorMessages.length - 1; i >= 0; i--) {
    if (priorMessages[i].toolResults?.some((tr) => tr.toolName === "createChart")) {
      lastChartMessageIndex = i;
      break;
    }
  }

  const history = priorMessages.map((m, i) => {
    if (i !== lastChartMessageIndex) return { role: m.role, content: m.content };
    const chartResult = m.toolResults?.find((tr) => tr.toolName === "createChart");
    const dataBlock = chartResult
      ? `\n\n[Dữ liệu đầy đủ của biểu đồ vừa tạo — dùng để trả lời chi tiết nếu user hỏi thêm về bất kỳ điểm nào: ${JSON.stringify(chartResult.output)}]`
      : "";
    return { role: m.role, content: m.content + dataBlock };
  });

  await appendMessage(userId, conversationId, "user", message);
  // Không chặn response chờ bước này, đặt tên chỉ là phụ trợ hiển thị, lỗi ở đây không đáng trì hoãn.
  setConversationTitleIfEmpty(userId, conversationId, message).catch((err) =>
    console.error("[orchestrator] Không đặt được tên cuộc trò chuyện:", err)
  );

  // Đính kèm tài liệu trong composer thì bỏ qua router, luôn coi là research trong đúng tài liệu đó.
  if (attachedDocumentId) {
    const stream = await streamResearchAnswer({ userId, message, history, conversationId, documentId: attachedDocumentId });
    return createUIMessageStreamResponse({ stream });
  }

  const { route } = await routerNode({ message });

  if (route === "research") {
    const stream = await streamResearchAnswer({ userId, message, history, conversationId });
    return createUIMessageStreamResponse({ stream });
  }

  if (route === "both") {
    let researchResult: string;
    try {
      researchResult = (await researchNode({ userId, message, history })).researchResult;
    } catch (err) {
      if (!isRetryableProviderError(err)) throw err; // lỗi khác — để rơi xuống app.onError như bình thường
      return overloadedResponse();
    }
    const result = await streamActionAnswer({
      userId,
      message,
      researchResult,
      history,
      conversationId,
    });
    return result.toUIMessageStreamResponse({ onError: toUserFacingErrorMessage });
  }

  // action hoặc unknown, action luôn là bước cuối, khớp fallback của routeDecision() ở index.ts
  const result = await streamActionAnswer({ userId, message, history, conversationId });
  return result.toUIMessageStreamResponse({ onError: toUserFacingErrorMessage });
});

export default app;
