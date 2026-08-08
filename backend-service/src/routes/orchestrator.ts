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
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

// Endpoint gốc, không streaming — giữ nguyên để test nhanh qua Postman như trước giờ.
// Cố ý KHÔNG có lịch sử hội thoại (chỉ dùng debug/test từng phần).
app.post("/agent/orchestrate", async (c) => {
  const userId = c.get("userId");
  const { message } = await c.req.json();

  const response = await runOrchestrator(message, userId);
  return c.json({ response });
});

// Endpoint streaming — dùng bởi chat UI thật. Router quyết định route trước (nhanh, không
// streaming), rồi node tương ứng stream câu trả lời cuối cùng thẳng cho client.
app.post("/agent/orchestrate/stream", async (c) => {
  const userId = c.get("userId");
  const { message, conversationId: requestedConversationId } = await c.req.json();

  // frontend-app là nơi quyết định "cuộc hội thoại nào đang active" (nút "Cuộc trò chuyện mới"
  // tạo conversation ở đó). Ở đây chỉ xác minh conversationId gửi lên thật sự thuộc về user này
  // trước khi dùng — chặn trường hợp gửi nhầm/cố tình gửi id của người khác.
  let conversationId: string;
  if (requestedConversationId) {
    const owns = await assertConversationOwnership(userId, requestedConversationId);
    if (!owns) return c.json({ error: "Invalid conversationId" }, 400);
    conversationId = requestedConversationId;
  } else {
    const latest = await getLatestConversation(userId);
    conversationId = latest ? latest.id : (await createConversation(userId)).id;
  }

  // Lưu tin nhắn user NGAY trước khi xử lý — nếu model lỗi giữa chừng, tin nhắn user vẫn không bị mất.
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

  // "action" hoặc "unknown" -> action là bước cuối, khớp fallback của routeDecision() trong agents/orchestrator/index.ts
  const result = await streamActionAnswer({ userId, message, history, conversationId });
  return result.toUIMessageStreamResponse();
});

export default app;
