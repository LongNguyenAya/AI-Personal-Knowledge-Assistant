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

// researchNode()'s "both" branch doesn't run in the stream, a temporary provider error builds its own UI message stream.
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

// Shares 1 pair of buckets across both endpoints so users can't dodge the limit through the debug endpoint.
const chatPerMinute = rateLimiter({ windowMs: 60 * 1000, maxSettingKey: "chatPerMinuteLimit", name: "chat-minute" });
const chatPerDay = rateLimiter({ windowMs: 24 * 60 * 60 * 1000, maxSettingKey: "chatPerDayLimit", name: "chat-day" });

// The original non-streaming endpoint, kept for quick testing via Postman, deliberately has no conversation history.
app.post("/agent/orchestrate", chatPerMinute, chatPerDay, async (c) => {
  const userId = c.get("userId");
  const { message } = await c.req.json();

  const response = await runOrchestrator(message, userId);
  return c.json({ response });
});

// The streaming endpoint used by the real chat UI, the router decides the route first, then streams the answer.
app.post("/agent/orchestrate/stream", chatPerMinute, chatPerDay, async (c) => {
  const userId = c.get("userId");
  const { message, conversationId: requestedConversationId, attachedDocumentId } = await c.req.json();

  // frontend-app decides which conversation is active, this just verifies it belongs to this user.
  let conversationId: string;
  if (requestedConversationId) {
    // Validates the format before querying, a non-UUID string would make Postgres throw a 500 instead of a 400.
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

  // Saves the user's message right before processing, so it isn't lost even if the model errors midway.
  const priorMessages = await listMessages(userId, conversationId);

  // The model can't see the real data of an old chart again, so the data gets injected into the most recent chart message.
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
      ? `\n\n[Dữ liệu đầy đủ của biểu đồ vừa tạo, dùng để trả lời chi tiết nếu user hỏi thêm về bất kỳ điểm nào: ${JSON.stringify(chartResult.output)}]`
      : "";
    return { role: m.role, content: m.content + dataBlock };
  });

  await appendMessage(userId, conversationId, "user", message);
  // Doesn't block the response waiting for this step, naming is just a display aid, an error here isn't worth delaying for.
  setConversationTitleIfEmpty(userId, conversationId, message).catch((err) =>
    console.error("[orchestrator] Không đặt được tên cuộc trò chuyện:", err)
  );

  // Attaching a document in the composer skips the router, always treated as research within that exact document.
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
      if (!isRetryableProviderError(err)) throw err; // other error, let it fall through to app.onError as usual
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

  // action or unknown, action is always the last step, matches routeDecision()'s fallback in index.ts
  const result = await streamActionAnswer({ userId, message, history, conversationId });
  return result.toUIMessageStreamResponse({ onError: toUserFacingErrorMessage });
});

export default app;
