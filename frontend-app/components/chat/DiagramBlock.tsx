"use client";
import { useEffect, useRef, useState } from "react";

// mermaid.initialize() should only run once for the whole app, the import promise is cached so it's shared as 1 instance.
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

// Each instance needs a unique DOM id since mermaid.render() requires one, ids aren't reused across renders.
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
        // Mermaid code written by the AI can have syntax errors, not a system bug, shows a compact error instead of crashing the whole page.
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
