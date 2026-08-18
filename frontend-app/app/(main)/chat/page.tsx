"use client";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { fetchJson } from "@/lib/fetch-json";
import { ChartBlock } from "@/components/chat/ChartBlock";
import { TaskListBlock } from "@/components/chat/TaskListBlock";
import type { ChartToolOutput, ListTasksOutput, SearchDocumentsOutput } from "@ai-assistant/shared-types";
import type { Conversation, StoredMessage } from "@/types/chat";

// remarkBreaks coi 1 dấu xuống dòng như <br> — AI hay xuống dòng đơn giữa các ý, khác quy ước
// markdown chuẩn (cần 2 dấu mới ngắt đoạn), thiếu plugin này chữ sẽ dính liền thành 1 dòng.
// Không set màu riêng cho các thẻ, để tự kế thừa màu bong bóng chat.
function ChatMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-1.5 list-decimal pl-4 last:mb-0">{children}</ol>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        code: ({ children }) => (
          <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">{children}</code>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

// Dựng lại tool part (vd chart) từ toolResults đã lưu — không có bước này thì tin nhắn cũ chỉ còn
// mỗi chữ AI nói, chart biến mất ngay khi tải lại trang dù lúc stream trực tiếp vẫn hiện đúng.
function toUIMessages(rows: StoredMessage[]): UIMessage[] {
  return rows.map((r, i) => ({
    id: `history-${i}`,
    role: r.role,
    parts: [
      { type: "text", text: r.content },
      ...(r.toolResults ?? []).map((tr, j) => ({
        type: `tool-${tr.toolName}` as const,
        toolCallId: `history-${i}-${j}`,
        state: "output-available" as const,
        input: {},
        output: tr.output,
      })),
    ],
  }));
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  // Dùng ref (không phải state) vì chỉ cần transport đọc được giá trị MỚI NHẤT lúc gửi request —
  // không cần re-render khi nó đổi.
  const conversationIdRef = useRef<string | null>(null);

  const [conversationList, setConversationList] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pattern chính thức của Vercel AI SDK: body là callback chỉ chạy lúc gửi request thật, không
  // phải lúc render, nên đọc ref ở đây an toàn. Mục đích là giữ transport không bị tạo lại mỗi
  // lần conversationId đổi — nếu đưa nó vào dependency, useChat sẽ coi như đổi transport và có
  // thể reset state chat giữa chừng. React Compiler (thử nghiệm) chưa nhận ra pattern này nên
  // tắt riêng 2 rule cho đoạn này.
  /* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: conversationIdRef.current }),
      }),
    []
  );
  /* eslint-enable react-hooks/refs, react-hooks/preserve-manual-memoization */

  // error (đổi tên chatError, tránh trùng state `error` phía trên) — useChat tự set field này khi
  // stream lỗi (vd Gemini quá tải, provider-errors.ts ở backend trả về), KHÔNG đi qua message.parts.
  const { messages, sendMessage, status, setMessages, error: chatError } = useChat({ transport });

  // requestSeq chặn race condition khi chuyển conversation nhanh — nếu response của A về sau
  // response của B (network không đảm bảo thứ tự), tin nhắn hiển thị sẽ nhầm sang A dù đang xem
  // B. Chỉ áp dụng response nếu nó vẫn là request mới nhất lúc hoàn thành.
  const requestSeqRef = useRef(0);
  const loadMessagesFor = useCallback(
    async (conversationId: string) => {
      const seq = ++requestSeqRef.current;
      try {
        const rows = await fetchJson<StoredMessage[]>(`/api/conversations/${conversationId}/messages`);
        if (requestSeqRef.current !== seq) return; // đã có request mới hơn, bỏ kết quả cũ này
        setMessages(toUIMessages(rows));
        setError(null);
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setError(err instanceof Error ? err.message : "Không tải được lịch sử chat");
      }
    },
    [setMessages, setError]
  );

  // Lúc mount: lấy danh sách conversation, chọn cái mới nhất làm active (tạo mới nếu chưa từng
  // chat lần nào), rồi nạp lại lịch sử tin nhắn của nó lên UI.
  useEffect(() => {
    (async () => {
      try {
        let list = await fetchJson<Conversation[]>("/api/conversations");
        if (list.length === 0) {
          const created = await fetchJson<Conversation>("/api/conversations", { method: "POST" });
          list = [created];
        }
        setConversationList(list);
        const latest = list[0];
        conversationIdRef.current = latest.id;
        setActiveId(latest.id);
        await loadMessagesFor(latest.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được danh sách hội thoại");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewConversation() {
    try {
      const created = await fetchJson<Conversation>("/api/conversations", { method: "POST" });
      conversationIdRef.current = created.id;
      setActiveId(created.id);
      setConversationList((prev) => [created, ...prev]);
      setMessages([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo cuộc trò chuyện mới thất bại");
    }
  }

  async function handleSelectConversation(id: string) {
    if (id === activeId) return;
    conversationIdRef.current = id;
    setActiveId(id);
    await loadMessagesFor(id);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4">
      <aside className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <button
          onClick={handleNewConversation}
          className="mb-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          + Cuộc trò chuyện mới
        </button>
        {conversationList.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelectConversation(c.id)}
            className={`truncate rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
              c.id === activeId
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {c.title ?? new Date(c.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
          </button>
        ))}
      </aside>

      <div className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Hỏi gì đó về tài liệu của bạn để bắt đầu.</p>
          )}
          {messages.map((m) => {
            // Multi-step tool-calling đôi khi model gọi sai tham số ở bước đầu (lỗi validate, không
            // phải lỗi thật của tool), rồi tự gọi lại đúng ở bước sau trong CÙNG tin nhắn — cả 2 lần
            // đều nằm trong parts. Ẩn lỗi tạm thời đó nếu cùng tool đã có kết quả thành công khác,
            // tránh doạ user bằng lỗi đã tự khắc phục.
            const succeededTools = new Set(
              m.parts.filter((p) => isToolUIPart(p) && p.state === "output-available").map((p) => getToolName(p))
            );

            return (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") return <ChatMarkdown key={i} text={part.text} />;

                  if (part.type === "source-document") {
                    return (
                      <div key={i} className="mt-1 text-xs opacity-80">
                        Nguồn: {part.filename ?? part.title}
                      </div>
                    );
                  }

                  if (isToolUIPart(part)) {
                    const name = getToolName(part);
                    if (part.state === "output-available") {
                      if (name === "createChart") {
                        const output = part.output as ChartToolOutput;
                        if (output.empty)
                          return (
                            <div key={i} className="mt-1 text-xs opacity-80">
                              {output.emptyReason === "no_data_ever"
                                ? "Bạn chưa có dữ liệu nào để vẽ biểu đồ này."
                                : "Không có hoạt động nào trong khoảng thời gian gần đây."}
                            </div>
                          );
                        return <ChartBlock key={i} {...output} />;
                      }
                      if (name === "listTasks") {
                        const output = part.output as ListTasksOutput;
                        if ("error" in output)
                          return (
                            <div key={i} className="mt-1 text-xs opacity-80">
                              {output.error}
                            </div>
                          );
                        return <TaskListBlock key={i} tasks={output.tasks} count={output.count} />;
                      }
                      if (name === "searchDocuments") {
                        // Hiện đúng fileName lấy từ kết quả tool trả về (dữ liệu thật, đã truy
                        // xuất được) — không dựa vào lời model tự kể lại đã đọc tài liệu nào, vì
                        // model có thể nhớ nhầm/bịa tên tài liệu.
                        const output = part.output as SearchDocumentsOutput;
                        const fileNames = [...new Set(output.results.map((r) => r.fileName))];
                        if (fileNames.length === 0)
                          return (
                            <div key={i} className="mt-1 text-xs opacity-80">
                              Không tìm thấy thông tin liên quan trong tài liệu.
                            </div>
                          );
                        return (
                          <div key={i} className="mt-1 text-xs opacity-80">
                            Nguồn: {fileNames.join(", ")}
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="mt-1 text-xs opacity-80">
                          Đã dùng tool: {name}
                        </div>
                      );
                    }
                    if (part.state === "output-error") {
                      if (succeededTools.has(name)) return null;
                      return (
                        <div key={i} className="mt-1 text-xs opacity-80">
                          Lỗi khi gọi tool: {name}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="mt-1 text-xs opacity-80">
                        AI đang gọi tool: {name}...
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
            );
          })}
          {status === "streaming" && <p className="text-xs text-gray-400 dark:text-gray-500">AI đang trả lời...</p>}
          {chatError && <p className="text-sm text-red-600 dark:text-red-400">{chatError.message}</p>}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi về tài liệu của bạn..."
            className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            Gửi
          </button>
        </form>
      </div>
    </div>
  );
}
