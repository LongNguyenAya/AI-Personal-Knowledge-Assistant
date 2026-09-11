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

// Rebuilds a tool part (e.g. a chart) from saved toolResults, without this step a chart would vanish on page reload.
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

// Path B: attach a NEW document right in the composer, it has to be uploaded and finish processing before the real question is sent.
type PendingTurn = {
  questionText: string;
  fileName: string;
  phase: "uploading" | "processing" | "failed";
  documentId?: string;
  elapsedSeconds: number;
  error?: string;
  // "timeout" just means the client gave up waiting so it doesn't call /retry, "failed" is a confirmed real error.
  failReason?: "failed" | "timeout";
};

// Deliberately repeats the backend's deriveTitle logic, this is only a temporary display name, the real value is decided by the backend.
const TITLE_MAX_WORDS = 6;
function deriveTitle(rawMessage: string): string {
  const words = rawMessage.trim().split(/\s+/);
  if (words.length <= TITLE_MAX_WORDS) return words.join(" ");
  return words.slice(0, TITLE_MAX_WORDS).join(" ") + "...";
}

const POLL_INTERVAL_MS = 3000;
// 90s since Gemini and embedding run sequentially chunk by chunk which can take a while, avoiding a false error right before it finishes.
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
      // A transient network error, ignored and retried on the next loop iteration instead of treating it as an immediate failure.
    }
  }
  return "timeout";
}

export default function ChatPage() {
  const [input, setInput] = useState("");

  // Other pages pre-fill a question via sessionStorage (read once then cleared) before navigating here, it isn't sent automatically.
  useEffect(() => {
    const prefill = sessionStorage.getItem(CHAT_PREFILL_STORAGE_KEY);
    if (prefill) {
      setInput(prefill);
      sessionStorage.removeItem(CHAT_PREFILL_STORAGE_KEY);
    }
  }, []);
  // Uses a ref instead of state since the transport only needs to read the latest value when sending, no re-render is needed when it changes.
  const conversationIdRef = useRef<string | null>(null);

  const [conversationList, setConversationList] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [convOpen, setConvOpen] = useState(false);

  // Path A: only picks a document already "processed", stays attached across multiple questions, the user clicks "x" to remove it.
  const [attachedDocument, setAttachedDocument] = useState<{ id: string; fileName: string } | null>(null);
  const attachedDocumentIdRef = useRef<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickableDocuments, setPickableDocuments] = useState<{ id: string; fileName: string }[] | null>(null);

  function attachDocument(doc: { id: string; fileName: string }) {
    setStagedNewFile(null); // mutually exclusive with a new document staged for upload
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
    if (pickableDocuments) return; // already loaded, doesn't call the API again every time it opens
    try {
      const docs = await fetchJson<{ id: string; fileName: string; status: string }[]>("/api/documents");
      setPickableDocuments(docs.filter((d) => d.status === "processed"));
    } catch {
      setPickableDocuments([]);
    }
  }

  // Path B: only picks the file here, upload and processing only start once Send is clicked (uploadThenAsk).
  const [stagedNewFile, setStagedNewFile] = useState<File | null>(null);
  const [pendingTurn, setPendingTurn] = useState<PendingTurn | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openNewFilePicker() {
    setPickerOpen(false);
    fileInputRef.current?.click();
  }

  function handleNewFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows picking this exact same file again later if needed
    if (!file) return;
    detachDocument(); // mutually exclusive with an already-existing document
    setStagedNewFile(file);
  }

  // Split into its own function so it's reusable for both the first attempt and "Retry", pollDocumentStatus manages its own timing.
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
              error: result === "timeout" ? "Taking a while to process — it may still be running, please wait a bit longer." : "Document processing failed.",
            }
          : p
      );
      return;
    }

    // The user already switched to a different conversation while waiting so this is silently canceled, avoiding sending the question to the wrong place.
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
      setPendingTurn((p) => (p ? { ...p, phase: "failed", error: "File upload failed." } : p));
      return;
    }

    await runProcessingWait(doc.id, doc.fileName, questionText, startConversationId);
  }

  function retryPendingUpload() {
    if (!pendingTurn?.documentId) return;
    const { documentId, fileName, questionText, failReason } = pendingTurn;
    const startConversationId = conversationIdRef.current;

    // A client-side timeout doesn't mean the server has stopped, it just keeps waiting and doesn't call /retry to avoid duplicating the SQS message.
    if (failReason === "timeout") {
      runProcessingWait(documentId, fileName, questionText, startConversationId);
      return;
    }

    fetchJson(`/api/documents/${documentId}/retry`, { method: "POST" })
      .then(() => runProcessingWait(documentId, fileName, questionText, startConversationId))
      .catch(() => setPendingTurn((p) => (p ? { ...p, phase: "failed", failReason: "failed", error: "Retry failed." } : p)));
  }

  // body is a callback that only runs when the real request is sent, keeping the transport from being recreated every time conversationId changes.
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

  // error is renamed to chatError to avoid a state name collision, useChat sets it itself when the stream errors, not through message.parts.
  const { messages, sendMessage, status, setMessages, error: chatError } = useChat({ transport });

  // requestSeq blocks a race condition when switching conversations quickly, the response is only applied if it's still the latest request.
  const requestSeqRef = useRef(0);
  const loadMessagesFor = useCallback(
    async (conversationId: string) => {
      const seq = ++requestSeqRef.current;
      try {
        const rows = await fetchJson<StoredMessage[]>(`/api/conversations/${conversationId}/messages`);
        if (requestSeqRef.current !== seq) return; // a newer request already exists, discards this stale result
        setMessages(toUIMessages(rows));
        setError(null);
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setError(err instanceof Error ? err.message : "Couldn't load chat history");
      }
    },
    [setMessages, setError]
  );

  // On mount: fetches the conversation list, picks the newest one as active, then loads the message history into the UI.
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
        setError(err instanceof Error ? err.message : "Couldn't load the conversation list");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleNewConversation() {
    // Abandons the pending turn, the document keeps processing on the backend, it's just no longer tied to any question.
    setPendingTurn(null);
    try {
      const created = await fetchJson<Conversation>("/api/conversations", { method: "POST" });
      conversationIdRef.current = created.id;
      setActiveId(created.id);
      setConversationList((prev) => [created, ...prev]);
      setMessages([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create new conversation");
    }
  }

  async function handleSelectConversation(id: string) {
    if (id === activeId) return;
    setPendingTurn(null); // same reason as in handleNewConversation
    conversationIdRef.current = id;
    setActiveId(id);
    await loadMessagesFor(id);
  }

  // Sets the display name right when the first question is sent, only changes it while title is still null to avoid overwriting an existing name.
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

  // 4rem = <main>'s py-8 at md+, below md the MainNav topbar (~3rem) also has to be subtracted so the chat frame doesn't overflow the viewport.
  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4 md:h-[calc(100vh-4rem)]">
      {/* The conversation list takes up too much room on narrow screens — hidden by default below
          md, shown as an overlay when the button is clicked (same pattern as MainNav/AdminSidebar). */}
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
          + New conversation
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
            <span className="w-full truncate text-xs font-medium">{c.title ?? "New conversation"}</span>
            <span className={`text-xs ${c.id === activeId ? "text-indigo-100" : "text-gray-500 dark:text-gray-400"}`}>
              {new Date(c.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
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
            Conversations
          </button>
          <h1 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {activeConversation?.title ?? "New conversation"}
          </h1>
        </div>
        <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Ask something about your documents to get started.</p>
          )}
          {messages.map((m) => {
            // Hides a transient tool error if that same tool already has another successful result in the same message.
            const succeededTools = new Set(
              m.parts.filter((p) => isToolUIPart(p) && p.state === "output-available").map((p) => getToolName(p))
            );

            // The "What the AI did" trace groups every finished tool call into 1 detail block, kept separate from the main display.
            const traceSteps = m.parts
              .filter((p) => isToolUIPart(p) && p.state === "output-available")
              .map((p) => ({ toolName: getToolName(p), input: (p as { input?: unknown }).input, output: (p as { output?: unknown }).output }));

            // The blinking cursor only shows on the exact last assistant message while status is still "streaming".
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
                        Source: {part.filename ?? part.title}
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
                                ? "You don't have any data yet to draw this chart."
                                : "No activity in this recent time range."}
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
                        // fileName comes from the tool's returned result, not the model's own claim since it could make up a name.
                        const output = part.output as SearchDocumentsOutput;
                        const fileNames = [...new Set(output.results.map((r) => r.fileName))];
                        if (fileNames.length === 0)
                          return (
                            <div key={i} className="mt-1 text-xs opacity-80">
                              No relevant information found in your documents.
                            </div>
                          );
                        return (
                          <div key={i} className="mt-1 text-xs opacity-80">
                            Source: {fileNames.join(", ")}
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="mt-1 text-xs opacity-80">
                          Used tool: {name}
                        </div>
                      );
                    }
                    if (part.state === "output-error") {
                      if (succeededTools.has(name)) return null;
                      return (
                        <div key={i} className="mt-1 text-xs opacity-80">
                          Error calling tool: {name}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="mt-1 text-xs opacity-80">
                        AI is calling tool: {name}...
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
                    <p className="text-xs text-gray-400 dark:text-gray-500">Uploading...</p>
                  )}
                  {pendingTurn.phase === "processing" && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">Processing document... ({pendingTurn.elapsedSeconds}s)</p>
                  )}
                  {pendingTurn.phase === "failed" && (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-red-500 dark:text-red-400">{pendingTurn.error}</p>
                      <button
                        type="button"
                        onClick={retryPendingUpload}
                        className="shrink-0 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
                      >
                        {pendingTurn.failReason === "timeout" ? "Wait longer" : "Retry"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {status === "submitted" && <p className="text-xs text-gray-400 dark:text-gray-500">Reading your question...</p>}
          {status === "streaming" && <p className="text-xs text-gray-400 dark:text-gray-500">AI is replying...</p>}
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
                  aria-label="Remove attachment"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {attachedDocument
                  ? "The question will only search this document"
                  : "New document — will upload and process as soon as you send the question"}
              </span>
            </div>
          )}

          {/* The gradient border only shows up clearly on focus — uses focus-within instead of a
              separate state, the browser reports on its own when a child element inside is focused, no JS tracking code needed. */}
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
                title="Attach a document"
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
                    Upload a new document...
                  </button>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                  {pickableDocuments === null && <p className="p-2 text-xs text-gray-400 dark:text-gray-500">Loading...</p>}
                  {pickableDocuments?.length === 0 && (
                    <p className="p-2 text-xs text-gray-400 dark:text-gray-500">No processed documents yet.</p>
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
                  ? `Ask about "${stagedNewFile.name}"...`
                  : attachedDocument
                    ? `Ask about "${attachedDocument.fileName}"...`
                    : "Ask about your documents..."
              }
              className="flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-gray-900 outline-none disabled:opacity-50 dark:text-white"
            />
            <button
              type="submit"
              disabled={!!pendingTurn}
              aria-label="Send"
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
