"use client";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { usePagedFetch } from "@/lib/use-paged-fetch";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PaginationControls } from "@/components/ui/PaginationControls";
import type { Reminder, RemindersResponse } from "@/types/reminders";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
};
const DEFAULT_STATUS_STYLE = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

// source phân biệt reminder user tự gõ vs AI tự trích từ tài liệu, trước đây hiện text thô "manual"/"ai_created" khó hiểu.
const SOURCE_LABEL: Record<string, string> = { manual: "Tạo thủ công", ai_created: "AI tạo từ tài liệu" };
const SOURCE_STYLE: Record<string, string> = {
  manual: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  ai_created: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
};

const PAGE_SIZE = 20;

export default function RemindersPage() {
  const { page, setPage, data, error, setError, totalPages, reload } = usePagedFetch<Reminder>(async (targetPage) => {
    const result = await fetchJson<RemindersResponse>(`/api/reminders?page=${targetPage}&pageSize=${PAGE_SIZE}`);
    return { items: result.reminders, total: result.total, page: result.page, pageSize: result.pageSize };
  });

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  const reminders = data?.items ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // input[type=datetime-local] trả chuỗi không có timezone, gắn cứng +07:00 trước khi đổi sang UTC.
    const dueAtUtc = new Date(`${dueAt}:00+07:00`).toISOString();
    setCreating(true);
    try {
      await fetchJson("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueAt: dueAtUtc }),
      });
      setTitle("");
      setDueAt("");
      // Reminder mới tạo luôn nằm đầu (sắp xếp mới nhất trước) -> về trang 1 để thấy ngay.
      if (page === 1) await reload();
      else setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo reminder thất bại");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetchJson(`/api/reminders/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xoá reminder thất bại");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reminders</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Tạo và theo dõi các nhắc nhở của bạn.</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Tiêu đề</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nhắc tôi..."
            required
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Thời gian</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            required
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? "Đang tạo..." : "Tạo"}
        </button>
      </form>

      {error && <ErrorBanner message={error} />}

      {data === null && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}
      {data !== null && reminders.length === 0 && (
        <EmptyState title="Chưa có reminder nào" description="Tạo reminder ở ô phía trên, hoặc nhờ AI trích từ tài liệu trong lúc chat." />
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {reminders.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-medium text-gray-900 dark:text-white">{r.title}</div>
              <button
                onClick={() => setConfirmTarget({ id: r.id, title: r.title })}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                Xoá
              </button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(r.dueAt).toLocaleString("vi-VN")}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  SOURCE_STYLE[r.source] ?? DEFAULT_STATUS_STYLE
                }`}
              >
                {SOURCE_LABEL[r.source] ?? r.source}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                  STATUS_STYLE[r.status] ?? DEFAULT_STATUS_STYLE
                }`}
              >
                {r.status}
              </span>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              Tạo lúc {new Date(r.createdAt).toLocaleDateString("vi-VN")}
            </div>
          </div>
        ))}
      </div>

      {data && (
        <PaginationControls page={page} totalPages={totalPages} total={data.total} itemLabel="reminder" onPageChange={setPage} />
      )}

      <ConfirmModal
        open={confirmTarget !== null}
        title="Xoá reminder này?"
        description={confirmTarget ? `"${confirmTarget.title}" sẽ bị xoá vĩnh viễn, không thể hoàn tác.` : ""}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) handleDelete(confirmTarget.id);
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}
