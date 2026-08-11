import { Hono } from "hono";
import { createUIMessageStreamResponse } from "ai";
import { runOrchestrator } from "../agents/orchestrator";
import { routerNode } from "../agents/orchestrator/router-node";
import { researchNode, streamResearchAnswer } from "../agents/orchestrator/research-node";
import { streamActionAnswer } from "../agents/orchestrator/action-node";
import {
  getLatestConversation,
  createConversation,
  assertConversationOwnership,
  listMessages,
  appendMessage,
} from "../db/repositories/chat-history";
import { rateLimiter } from "../middleware/rate-limit";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dùng chung 1 cặp bucket "chat-minute"/"chat-day" cho cả 2 endpoint — 1 tin nhắn chat đã tốn
// 2-7 lệnh gọi Gemini (router + research/action, action lại cho phép tối đa 5 vòng tool-calling),
// nên không cho user lách giới hạn bằng cách gọi endpoint debug thay vì endpoint stream.
const chatPerMinute = rateLimiter({ windowMs: 60 * 1000, max: 10, name: "chat-minute" });
const chatPerDay = rateLimiter({ windowMs: 24 * 60 * 60 * 1000, max: 100, name: "chat-day" });

// Endpoint gốc, không streaming — giữ nguyên để test nhanh qua Postman như trước giờ.
// Cố ý không có lịch sử hội thoại (chỉ dùng debug/test từng phần).
app.post("/agent/orchestrate", chatPerMinute, chatPerDay, async (c) => {
  const userId = c.get("userId");
  const { message } = await c.req.json();

  const response = await runOrchestrator(message, userId);
  return c.json({ response });
});

// Endpoint streaming — dùng bởi chat UI thật. Router quyết định route trước (nhanh, không
// streaming), rồi node tương ứng stream câu trả lời cuối cùng thẳng cho client.
app.post("/agent/orchestrate/stream", chatPerMinute, chatPerDay, async (c) => {
  const userId = c.get("userId");
  const { message, conversationId: requestedConversationId } = await c.req.json();

  // frontend-app quyết định cuộc hội thoại nào đang active (nút "Cuộc trò chuyện mới" tạo
  // conversation ở đó) — ở đây chỉ xác minh conversationId gửi lên thật sự thuộc về user này.
  let conversationId: string;
  if (requestedConversationId) {
    // Validate format trước khi query — chuỗi không phải UUID sẽ khiến Postgres ném lỗi, rơi
    // xuống global onError thành 500, trong khi ý định thật ở đây là trả 400.
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

  // Lưu tin nhắn user ngay trước khi xử lý — nếu model lỗi giữa chừng, tin nhắn user vẫn không bị mất.
  const priorMessages = await listMessages(userId, conversationId);
  const history = priorMessages.map((m) => ({ role: m.role, content: m.content }));
  await appendMessage(userId, conversationId, "user", message);

  const { route } = await routerNode({ message });

  if (route === "research") {
    const stream = await streamResearchAnswer({ userId, message, history, conversationId });
    return createUIMessageStreamResponse({ stream });
  }

  if (route === "both") {
    const { researchResult } = await researchNode({ userId, message, history });
    const result = await streamActionAnswer({
      userId,
      message,
      researchResult,
      history,
      conversationId,
    });
    return result.toUIMessageStreamResponse();
  }

  // "action" hoặc "unknown" — action luôn là bước cuối, khớp fallback của routeDecision() ở agents/orchestrator/index.ts
  const result = await streamActionAnswer({ userId, message, history, conversationId });
  return result.toUIMessageStreamResponse();
});

export default app;
