"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  // Dùng ref (không phải state) vì chỉ cần transport đọc được giá trị MỚI NHẤT lúc gửi request —
  // không cần re-render khi nó đổi.
  const conversationIdRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ conversationId: conversationIdRef.current }),
      }),
    []
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  // Lấy cuộc hội thoại gần nhất lúc vào trang (hoặc tạo mới nếu chưa từng chat).
  useEffect(() => {
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((conv) => {
        conversationIdRef.current = conv.id;
      });
  }, []);

  async function handleNewConversation() {
    const res = await fetch("/api/conversations", { method: "POST" });
    const conv = await res.json();
    conversationIdRef.current = conv.id;
    setMessages([]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div>
      <button onClick={handleNewConversation}>+ Cuộc trò chuyện mới</button>

      <div>
        {messages.map((m) => (
          <div key={m.id}>
            <strong>{m.role === "user" ? "Bạn" : "AI"}:</strong>{" "}
            {m.parts.map((part, i) => {
              if (part.type === "text") return <span key={i}>{part.text}</span>;

              if (part.type === "source-document") {
                return <div key={i}>📄 Nguồn: {part.filename ?? part.title}</div>;
              }

              if (isToolUIPart(part)) {
                const name = getToolName(part);
                if (part.state === "output-available") return <div key={i}>✅ Đã dùng tool: {name}</div>;
                if (part.state === "output-error") return <div key={i}>⚠️ Lỗi khi gọi tool: {name}</div>;
                return <div key={i}>🔧 AI đang gọi tool: {name}...</div>;
              }

              return null;
            })}
          </div>
        ))}
        {status === "streaming" && <p>AI đang trả lời...</p>}
      </div>

      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Hỏi về tài liệu của bạn..." />
        <button type="submit">Gửi</button>
      </form>
    </div>
  );
}
