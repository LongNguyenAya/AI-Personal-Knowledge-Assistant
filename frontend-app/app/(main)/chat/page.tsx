"use client";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Paperclip, X, Send } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { ChartBlock } from "@/components/chat/ChartBlock";
import { TaskListBlock } from "@/components/chat/TaskListBlock";
import { TraceBlock } from "@/components/chat/TraceBlock";
import { DiagramBlock } from "@/components/chat/DiagramBlock";
import { Markdown } from "@/components/ui/Markdown";
import type { ChartToolOutput, ListTasksOutput, SearchDocumentsOutput, DiagramToolOutput } from "@ai-assistant/shared-types";
import type { Conversation, StoredMessage } from "@/types/chat";
import { CHAT_PREFILL_STORAGE_KEY } from "@/lib/chat-prefill";

// Dựng lại tool part (vd chart) từ toolResults đã lưu, thiếu bước này chart sẽ biến mất khi tải lại trang.
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
        input: tr.input ?? {},
        output: tr.output,
      })),
    ],
  }));
}

// Hướng B: đính kèm tài liệu MỚI ngay trong composer, phải upload và chờ xử lý xong mới gửi câu hỏi thật.
type PendingTurn = {
  questionText: string;
  fileName: string;
  phase: "uploading" | "processing" | "failed";
  documentId?: string;
  elapsedSeconds: number;
  error?: string;
  // "timeout" chỉ là client hết kiên nhẫn chờ nên không gọi /retry, "failed" mới là lỗi thật đã xác nhận.
  failReason?: "failed" | "timeout";
};

// Lặp lại logic deriveTitle của backend có chủ đích, đây chỉ là tên hiển thị tạm, giá trị thật do backend quyết định.
const TITLE_MAX_WORDS = 6;
function deriveTitle(rawMessage: string): string {
  const words = rawMessage.trim().split(/\s+/);
  if (words.length <= TITLE_MAX_WORDS) return words.join(" ");
  return words.slice(0, TITLE_MAX_WORDS).join(" ") + "...";
}

const POLL_INTERVAL_MS = 3000;
// 90s vì Gemini và embedding chạy tuần tự từng đoạn có thể lâu, tránh báo lỗi oan lúc sắp xong.
const PROCESSING_TIMEOUT_MS = 90_000;

async function pollDocumentStatus(
  documentId: string,
  onTick: (elapsedSeconds: number) => void
): Promise<"processed" | "failed" | "timeout"> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < PROCESSING_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    onTick(Math.floor((Date.now() - startedAt) / 1000));
    try {
      const doc = await fetchJson<{ status: string }>(`/api/documents/${documentId}`);
      if (doc.status === "processed") return "processed";
      if (doc.status === "failed") return "failed";
    } catch {
      // Lỗi mạng tạm thời, bỏ qua và thử lại ở vòng lặp sau thay vì coi là thất bại ngay.
    }
  }
  return "timeout";
}

export default function ChatPage() {
  const [input, setInput] = useState("");

  // Trang khác điền sẵn câu hỏi qua sessionStorage (đọc 1 lần rồi xoá) rồi điều hướng sang, không tự gửi luôn.
  useEffect(() => {
    const prefill = sessionStorage.getItem(CHAT_PREFILL_STORAGE_KEY);
    if (prefill) {
      setInput(prefill);
      sessionStorage.removeItem(CHAT_PREFILL_STORAGE_KEY);
    }
  }, []);
  // Dùng ref thay vì state vì chỉ cần transport đọc giá trị mới nhất lúc gửi, không cần re-render khi đổi.
  const conversationIdRef = useRef<string | null>(null);

  const [conversationList, setConversationList] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [convOpen, setConvOpen] = useState(false);

  // Hướng A: chỉ chọn tài liệu đã "processed", giữ nguyên qua nhiều lượt hỏi, user tự bấm "x" để bỏ.
  const [attachedDocument, setAttachedDocument] = useState<{ id: string; fileName: string } | null>(null);
  const attachedDocumentIdRef = useRef<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickableDocuments, setPickableDocuments] = useState<{ id: string; fileName: string }[] | null>(null);

  function attachDocument(doc: { id: string; fileName: string }) {
    setStagedNewFile(null); // loại trừ lẫn nhau với tài liệu mới đang chờ upload
    attachedDocumentIdRef.current = doc.id;
    setAttachedDocument(doc);
    setPickerOpen(false);
  }

  function detachDocument() {
    attachedDocumentIdRef.current = null;
    setAttachedDocument(null);
  }

  async function openPicker() {
    setPickerOpen((open) => !open);
    if (pickableDocuments) return; // đã tải rồi, không gọi lại API mỗi lần mở
    try {
      const docs = await fetchJson<{ id: string; fileName: string; status: string }[]>("/api/documents");
      setPickableDocuments(docs.filter((d) => d.status === "processed"));
    } catch {
      setPickableDocuments([]);
    }
  }

  // Hướng B: chỉ chọn file ở đây, upload và chờ xử lý chỉ bắt đầu lúc bấm Gửi (uploadThenAsk).
  const [stagedNewFile, setStagedNewFile] = useState<File | null>(null);
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openNewFilePicker() {
    setPickerOpen(false);
    fileInputRef.current?.click();
  }

  function handleNewFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại đúng file này lần nữa nếu cần
    if (!file) return;
    detachDocument(); // loại trừ lẫn nhau với tài liệu có sẵn
    setStagedNewFile(file);
  }

  // Tách hàm này để dùng lại được cho cả lần thử đầu và lần "Thử lại", pollDocumentStatus tự quản lý mốc thời gian riêng.
  async function runProcessingWait(documentId: string, fileName: string, questionText: string, startConversationId: string | null) {
    setPendingTurn((p) => (p ? { ...p, phase: "processing", documentId, elapsedSeconds: 0, error: undefined } : p));

    const result = await pollDocumentStatus(documentId, (elapsedSeconds) =>
      setPendingTurn((p) => (p && p.documentId === documentId ? { ...p, elapsedSeconds } : p))
    );

    if (result !== "processed") {
      setPendingTurn((p) =>
        p && p.documentId === documentId
          ? {
              ...p,
              phase: "failed",
              failReason: result,
              error: result === "timeout" ? "Xử lý hơi lâu — vẫn có thể đang chạy, bạn chờ thêm nhé." : "Xử lý tài liệu thất bại.",
            }
          : p
      );
      return;
    }

    // User đã chuyển sang cuộc trò chuyện khác trong lúc chờ nên huỷ âm thầm, tránh gửi nhầm câu hỏi.
    if (conversationIdRef.current !== startConversationId) {
      setPendingTurn(null);
      return;
    }

    attachedDocumentIdRef.current = documentId;
    setAttachedDocument({ id: documentId, fileName });
    setPendingTurn(null);
    applyOptimisticTitle(questionText);
    sendMessage({ text: questionText });
  }

  async function uploadThenAsk(questionText: string, file: File) {
    setStagedNewFile(null);
    setInput("");
    const startConversationId = conversationIdRef.current;
    setPendingTurn({ questionText, fileName: file.name, phase: "uploading", elapsedSeconds: 0 });

    let doc: { id: string; fileName: string };
    try {
      const formData = new FormData();
      formData.append("file", file);
      doc = await fetchJson<{ id: string; fileName: string }>("/api/documents", { method: "POST", body: formData });
    } catch {
      setPendingTurn((p) => (p ? { ...p, phase: "failed", error: "Tải file lên thất bại." } : p));
      return;
    }

    await runProcessingWait(doc.id, doc.fileName, questionText, startConversationId);
  }

  function retryPendingUpload() {
    if (!pendingTurn?.documentId) return;
    const { documentId, fileName, questionText, failReason } = pendingTurn;
    const startConversationId = conversationIdRef.current;

    // Timeout ở client không có nghĩa server đã dừng, chỉ chờ tiếp và không gọi /retry để tránh trùng SQS.
    if (failReason === "timeout") {
      runProcessingWait(documentId, fileName, questionText, startConversationId);
      return;
    }

    fetchJson(`/api/documents/${documentId}/retry`, { method: "POST" })
      .then(() => runProcessingWait(documentId, fileName, questionText, startConversationId))
      .catch(() => setPendingTurn((p) => (p ? { ...p, phase: "failed", failReason: "failed", error: "Thử lại thất bại." } : p)));
  }

  // body là callback chỉ chạy lúc gửi request thật, giữ transport không bị tạo lại mỗi lần conversationId đổi.
  /* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization */
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: conversationIdRef.current, attachedDocumentId: attachedDocumentIdRef.current }),
      }),
    []
  );
  /* eslint-enable react-hooks/refs, react-hooks/preserve-manual-memoization */

  // error đổi tên thành chatError để tránh trùng state, useChat tự set khi stream lỗi, không qua message.parts.
  const { messages, sendMessage, status, setMessages, error: chatError } = useChat({ transport });

  // requestSeq chặn race condition khi đổi conversation nhanh, chỉ áp dụng response nếu vẫn là request mới nhất.
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

  // Lúc mount: lấy danh sách conversation, chọn cái mới nhất làm active, rồi nạp lịch sử tin nhắn lên UI.
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
    // Bỏ dở lượt đang chờ, tài liệu vẫn tiếp tục xử lý ở backend, chỉ không còn gắn với lượt hỏi nào nữa.
    setPendingTurn(null);
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
    setPendingTurn(null); // cùng lý do ở handleNewConversation
    conversationIdRef.current = id;
    setActiveId(id);
    await loadMessagesFor(id);
  }

  // Đặt tên hiển thị ngay khi gửi câu hỏi đầu tiên, chỉ đổi khi title đang null để tránh ghi đè tên cũ.
  function applyOptimisticTitle(text: string) {
    const currentId = conversationIdRef.current;
    setConversationList((prev) =>
      prev.map((c) => (c.id === currentId && c.title === null ? { ...c, title: deriveTitle(text) } : c))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || pendingTurn) return;
    if (stagedNewFile) {
      uploadThenAsk(input.trim(), stagedNewFile);
      return;
    }
    applyOptimisticTitle(input);
    sendMessage({ text: input });
    setInput("");
  }

  const activeConversation = conversationList.find((c) => c.id === activeId) ?? null;

  // 4rem = py-8 của <main> ở md+, dưới md phải trừ thêm topbar MainNav (~3rem) để khung chat không tràn viewport.
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 md:h-[calc(100vh-4rem)]">
      {/* Danh sách cuộc trò chuyện chiếm quá nhiều chỗ trên màn hình hẹp — ẩn mặc định dưới md,
          hiện dạng overlay khi bấm nút (cùng pattern MainNav/AdminSidebar). */}
      {convOpen && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setConvOpen(false)} />}
      <aside
        className={`${
          convOpen ? "flex" : "hidden"
        } thin-scrollbar fixed inset-y-0 left-0 z-50 w-64 min-h-0 flex-col gap-2 overflow-y-auto border-r border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 md:static md:z-auto md:flex md:w-64 md:shrink-0 md:rounded-xl md:border md:shadow-soft`}
      >
        <button
          onClick={() => {
            handleNewConversation();
            setConvOpen(false);
          }}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          + Cuộc trò chuyện mới
        </button>
        {conversationList.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              handleSelectConversation(c.id);
              setConvOpen(false);
            }}
            className={`flex w-full shrink-0 flex-col items-start gap-1 overflow-hidden rounded-lg px-3 py-2.5 text-left transition-colors ${
              c.id === activeId
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            <span className="w-full truncate text-xs font-medium">{c.title ?? "Cuộc trò chuyện mới"}</span>
            <span className={`text-xs ${c.id === activeId ? "text-indigo-100" : "text-gray-500 dark:text-gray-400"}`}>
              {new Date(c.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </button>
        ))}
      </aside>

      <div className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white shadow-soft dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            onClick={() => setConvOpen(true)}
            className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 md:hidden dark:border-gray-700 dark:text-gray-300"
          >
            Cuộc trò chuyện
          </button>
          <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {activeConversation?.title ?? "Cuộc trò chuyện mới"}
          </h1>
        </div>
        <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Hỏi gì đó về tài liệu của bạn để bắt đầu.</p>
          )}
          {messages.map((m) => {
            // Ẩn lỗi tool tạm thời nếu cùng tool đã có kết quả thành công khác trong cùng tin nhắn.
            const succeededTools = new Set(
              m.parts.filter((p) => isToolUIPart(p) && p.state === "output-available").map((p) => getToolName(p))
            );

            // Trace "AI đã làm gì" gom tất cả tool call đã xong thành 1 khối xem chi tiết, tách biệt hiển thị chính.
            const traceSteps = m.parts
              .filter((p) => isToolUIPart(p) && p.state === "output-available")
              .map((p) => ({ toolName: getToolName(p), input: (p as { input?: unknown }).input, output: (p as { output?: unknown }).output }));

            // Con trỏ nhấp nháy chỉ hiện ở đúng tin nhắn assistant cuối cùng lúc status còn "streaming".
            const isStreamingThisMessage = status === "streaming" && m.role === "assistant" && messages[messages.length - 1]?.id === m.id;

            return (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "rounded-2xl rounded-br-md bg-indigo-600 text-white"
                    : "rounded-2xl rounded-bl-md border-l-2 border-indigo-600 bg-white text-gray-800 shadow-soft dark:bg-gray-900 dark:text-gray-100"
                }`}
              >
                {m.role === "assistant" && (
                  <p className="mb-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">AI Knowledge Assistant</p>
                )}
                {m.parts.map((part, i) => {
                  if (part.type === "text") return <Markdown key={i} text={part.text} />;

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
                      if (name === "createDiagram") {
                        const output = part.output as DiagramToolOutput;
                        return <DiagramBlock key={i} title={output.title} mermaidCode={output.mermaidCode} />;
                      }
                      if (name === "searchDocuments") {
                        // fileName lấy từ kết quả tool trả về, không dựa lời model tự kể vì có thể bịa tên.
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
                {isStreamingThisMessage && (
                  <span className="blink-cursor ml-0.5 inline-block h-[15px] w-[2px] rounded-sm bg-gradient-to-b from-indigo-600 to-amber-500 align-[-3px]" />
                )}
                {m.role === "assistant" && <TraceBlock steps={traceSteps} />}
              </div>
            </div>
            );
          })}
          {pendingTurn && (
            <>
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white">
                  <span className="mb-1 flex items-center gap-1.5 text-[11px] text-indigo-100">
                    <Paperclip className="h-3 w-3" />
                    {pendingTurn.fileName}
                  </span>
                  {pendingTurn.questionText}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-md border-l-2 border-indigo-600 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-soft dark:bg-gray-900 dark:text-gray-100">
                  <p className="mb-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">AI Knowledge Assistant</p>
                  {pendingTurn.phase === "uploading" && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Đang tải lên...</p>
                  )}
                  {pendingTurn.phase === "processing" && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Đang xử lý tài liệu... ({pendingTurn.elapsedSeconds}s)</p>
                  )}
                  {pendingTurn.phase === "failed" && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-red-500 dark:text-red-400">{pendingTurn.error}</p>
                      <button
                        type="button"
                        onClick={retryPendingUpload}
                        className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        {pendingTurn.failReason === "timeout" ? "Chờ thêm" : "Thử lại"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {status === "submitted" && <p className="text-xs text-gray-400 dark:text-gray-500">Đang đọc câu hỏi...</p>}
          {status === "streaming" && <p className="text-xs text-gray-400 dark:text-gray-500">AI đang trả lời...</p>}
          {chatError && <p className="text-sm text-red-600 dark:text-red-400">{chatError.message}</p>}
        </div>

        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          {(attachedDocument || stagedNewFile) && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Paperclip className="h-3 w-3" />
                {attachedDocument ? attachedDocument.fileName : stagedNewFile!.name}
                <button
                  type="button"
                  onClick={attachedDocument ? detachDocument : () => setStagedNewFile(null)}
                  aria-label="Bỏ đính kèm"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {attachedDocument
                  ? "Câu hỏi sẽ chỉ tìm trong tài liệu này"
                  : "Tài liệu mới — sẽ tải lên và xử lý ngay khi bạn gửi câu hỏi"}
              </span>
            </div>
          )}

          {/* Viền gradient chỉ nổi rõ lúc focus — dùng focus-within thay vì state riêng, trình
              duyệt tự báo khi phần tử con bên trong đang được focus, không cần code JS theo dõi. */}
          <div className="rounded-[18px] bg-gray-200 p-px transition-colors duration-200 focus-within:bg-gradient-to-br focus-within:from-indigo-600/85 focus-within:to-amber-500/55 dark:bg-gray-800">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-[17px] bg-white px-2 py-1.5 dark:bg-gray-950">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
              onChange={handleNewFileSelected}
              className="hidden"
            />
            <div className="relative">
              <button
                type="button"
                onClick={openPicker}
                title="Đính kèm tài liệu"
                disabled={!!pendingTurn}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {pickerOpen && (
                <div className="absolute bottom-full left-0 z-10 mb-2 w-64 rounded-lg border border-gray-200 bg-white p-1.5 shadow-soft dark:border-gray-800 dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={openNewFilePicker}
                    className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                  >
                    Tải tài liệu mới lên...
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                  {pickableDocuments === null && <p className="p-2 text-xs text-gray-400 dark:text-gray-500">Đang tải...</p>}
                  {pickableDocuments?.length === 0 && (
                    <p className="p-2 text-xs text-gray-400 dark:text-gray-500">Chưa có tài liệu nào đã xử lý xong.</p>
                  )}
                  {pickableDocuments?.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => attachDocument(doc)}
                      className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      title={doc.fileName}
                    >
                      {doc.fileName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!!pendingTurn}
              placeholder={
                stagedNewFile
                  ? `Hỏi về "${stagedNewFile.name}"...`
                  : attachedDocument
                    ? `Hỏi về "${attachedDocument.fileName}"...`
                    : "Hỏi về tài liệu của bạn..."
              }
              className="flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-gray-900 outline-none disabled:opacity-50 dark:text-white"
            />
            <button
              type="submit"
              disabled={!!pendingTurn}
              aria-label="Gửi"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-amber-500 text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-[15px] w-[15px]" />
            </button>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}
