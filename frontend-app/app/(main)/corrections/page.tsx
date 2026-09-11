"use client";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { usePagedFetch } from "@/lib/use-paged-fetch";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { wordDiff } from "@/lib/word-diff";

type CorrectionStatus = "inactive" | "active" | "dismissed";

type CorrectionMemory = {
  id: string;
  sourceType: string;
  fieldName: string;
  wrongValue: string | null;
  correctedValue: string | null;
  confidence: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

// A purely visual color threshold, unrelated to the real threshold used for ranking, just helps the eye scan which notes are more "confident".
function confidenceBadgeStyle(confidence: number): string {
  if (confidence >= 80) return "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300";
  if (confidence >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";
}

type CorrectionsResponse = {
  corrections: CorrectionMemory[];
  total: number;
  page: number;
  pageSize: number;
};

const TABS: { status: CorrectionStatus; label: string }[] = [
  { status: "inactive", label: "Pending" },
  { status: "active", label: "Approved" },
  { status: "dismissed", label: "Dismissed" },
];

const EMPTY_TITLE: Record<CorrectionStatus, string> = {
  inactive: "No notes pending review",
  active: "No approved notes yet",
  dismissed: "No dismissed notes yet",
};

const EMPTY_DESCRIPTION: Record<CorrectionStatus, string> = {
  inactive: "The AI will suggest a note on its own when it runs into a tricky situation — nothing here yet.",
  active: "Notes you've approved will show up here.",
  dismissed: "Notes you've dismissed will show up here.",
};

const PAGE_SIZE = 20;

// A page for reviewing AI-suggested observations, unlike a user-made correction which takes effect right away, "Undo" returns it to the pending queue.
export default function CorrectionsPage() {
  const [tab, setTab] = useState<CorrectionStatus>("inactive");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { page, setPage, data, error, setError, totalPages, reload } = usePagedFetch<CorrectionMemory>(
    async (targetPage) => {
      const result = await fetchJson<CorrectionsResponse>(
        `/api/corrections?status=${tab}&page=${targetPage}&pageSize=${PAGE_SIZE}`
      );
      return { items: result.corrections, total: result.total, page: result.page, pageSize: result.pageSize };
    },
    [tab]
  );

  // Switching tabs has to reset to page 1, otherwise it could be stuck on a page from the old tab that the new tab doesn't have enough items for.
  function switchTab(next: CorrectionStatus) {
    setTab(next);
    setPage(1);
  }

  async function patchStatus(id: string, status: CorrectionStatus) {
    setPendingId(id);
    try {
      await fetchJson(`/api/corrections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPendingId(null);
    }
  }

  const items = data?.items ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Notes</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          The AI suggests observations on its own when it runs into an ambiguous situation while processing — these only take effect once you approve them.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.status}
            onClick={() => switchTab(t.status)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.status
                ? "bg-indigo-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={error} />}

      {data === null && <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>}
      {data !== null && items.length === 0 && (
        <EmptyState title={EMPTY_TITLE[tab]} description={EMPTY_DESCRIPTION[tab]} />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                {item.sourceType} / {item.fieldName}
              </span>
              {/* This value drives the ranking fed into the AI prompt (ORDER BY confidence DESC,
                  usageCount DESC) — shown so you can see why 1 note is prioritized over another. */}
              <span className={`rounded-full px-2 py-0.5 font-medium ${confidenceBadgeStyle(item.confidence)}`}>
                Confidence {item.confidence}
                {item.usageCount > 1 ? ` · ×${item.usageCount}` : ""}
              </span>
            </div>
            {/* wrongValue only exists for a correction the user made themselves — an AI-suggested
                note has nothing to compare against so it's just shown plain. Diffed word by word so only the actual difference is highlighted. */}
            {item.wrongValue ? (
              <p className="text-sm text-gray-800 dark:text-gray-100">
                {wordDiff(item.wrongValue, item.correctedValue ?? "").map((seg, i) => {
                  if (seg.type === "removed") {
                    return (
                      <span key={i} className="text-red-500 line-through dark:text-red-400">
                        {seg.value}
                      </span>
                    );
                  }
                  if (seg.type === "added") {
                    return (
                      <span key={i} className="font-semibold text-green-700 dark:text-green-400">
                        {seg.value}
                      </span>
                    );
                  }
                  return <span key={i}>{seg.value}</span>;
                })}
              </p>
            ) : (
              <p className="text-sm text-gray-800 dark:text-gray-100">{item.correctedValue}</p>
            )}
            <div className="text-xs text-gray-400 dark:text-gray-500">
              {tab === "inactive"
                ? new Date(item.createdAt).toLocaleString("en-US")
                : `Updated ${new Date(item.updatedAt).toLocaleString("en-US")}`}
            </div>
            <div className="flex gap-2">
              {tab === "inactive" ? (
                <>
                  <button
                    onClick={() => patchStatus(item.id, "active")}
                    disabled={pendingId === item.id}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => patchStatus(item.id, "dismissed")}
                    disabled={pendingId === item.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <button
                  onClick={() => patchStatus(item.id, "inactive")}
                  disabled={pendingId === item.id}
                  title="Return this note to the pending queue"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {data && (
        <PaginationControls page={page} totalPages={totalPages} total={data.total} itemLabel="notes" onPageChange={setPage} />
      )}
    </div>
  );
}
