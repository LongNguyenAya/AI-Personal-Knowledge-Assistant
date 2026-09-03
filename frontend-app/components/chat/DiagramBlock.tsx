"use client";
import { useEffect, useRef, useState } from "react";

// mermaid.initialize() chỉ nên chạy 1 lần cho cả app, cache lại promise import để dùng chung 1 instance.
let mermaidPromise: Promise<typeof import("mermaid")> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({ startOnLoad: false, theme: "neutral" });
      return m;
    });
  }
  return mermaidPromise;
}

let diagramSeq = 0;

// Mỗi instance cần 1 id DOM duy nhất vì mermaid.render() yêu cầu, không dùng lại id giữa các lần render.
export function DiagramBlock({ title, mermaidCode }: { title: string; mermaidCode: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-diagram-${++diagramSeq}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await loadMermaid();
        const { svg } = await mermaid.render(idRef.current, mermaidCode);
        if (!cancelled && containerRef.current) containerRef.current.innerHTML = svg;
      } catch (err) {
        // Mã Mermaid do AI tự viết có thể sai cú pháp, không phải lỗi hệ thống, hiện lỗi gọn thay vì crash cả trang.
        if (!cancelled) setError(err instanceof Error ? err.message : "Không vẽ được sơ đồ này.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mermaidCode]);

  return (
    <div className="mt-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">{title}</p>
      {error ? <p className="text-xs text-red-500 dark:text-red-400">{error}</p> : <div ref={containerRef} />}
    </div>
  );
}
