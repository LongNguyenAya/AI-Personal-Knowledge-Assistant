"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { AgentPrompt } from "@/types/admin";

const LABELS: Record<AgentPrompt["agentType"], { title: string; desc: string }> = {
  research: {
    title: "Research",
    desc: "Trả lời câu hỏi tra cứu tài liệu",
  },
  action: {
    title: "Action",
    desc: "Thực hiện hành động: tạo task/reminder",
  },
  orchestrator: {
    title: "Orchestrator",
    desc: "Phân loại ý định của câu hỏi",
  },
  pdf_extraction: {
    title: "PDF Extraction",
    desc: "Trích xuất nội dung + mô tả ảnh khi upload PDF",
  },
};

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingType, setSavingType] = useState<string | null>(null);
  const [savedType, setSavedType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await fetchJson<AgentPrompt[]>("/api/admin/prompts");
      setPrompts(data);
      setDrafts(Object.fromEntries(data.map((p) => [p.agentType, p.systemPrompt])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được prompt");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function save(agentType: string) {
    setSavingType(agentType);
    try {
      await fetchJson(`/api/admin/prompts/${agentType}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: drafts[agentType] }),
      });
      setSavedType(agentType);
      setTimeout(() => setSavedType(null), 2000);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu prompt thất bại");
    } finally {
      setSavingType(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Prompts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sửa xong sẽ tạo 1 phiên bản mới — phiên bản cũ vẫn được giữ lại.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {!loaded && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        {prompts.map((p) => {
          const dirty = drafts[p.agentType] !== p.systemPrompt;
          return (
            <div
              key={p.agentType}
              className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{LABELS[p.agentType].title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{LABELS[p.agentType].desc}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  v{p.version}
                </span>
              </div>

              <div className="p-5">
                <textarea
                  rows={10}
                  className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm text-gray-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:focus:ring-indigo-500/20"
                  value={drafts[p.agentType] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [p.agentType]: e.target.value })}
                />
                <div className="mt-3 flex items-center justify-end gap-3">
                  {savedType === p.agentType && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">Đã lưu</span>
                  )}
                  <button
                    onClick={() => save(p.agentType)}
                    disabled={savingType === p.agentType || !dirty}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
                  >
                    {savingType === p.agentType ? "Đang lưu..." : "Lưu (tạo version mới)"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
