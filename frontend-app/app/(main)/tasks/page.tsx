"use client";
import { useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { usePagedFetch } from "@/lib/use-paged-fetch";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PaginationControls } from "@/components/ui/PaginationControls";
import type { Task, TasksResponse } from "@/types/tasks";

const PAGE_SIZE = 20;

export default function TasksPage() {
  const { page, setPage, data, error, setError, totalPages, reload } = usePagedFetch<Task>(async (targetPage) => {
    const result = await fetchJson<TasksResponse>(`/api/tasks?page=${targetPage}&pageSize=${PAGE_SIZE}`);
    return { items: result.tasks, total: result.total, page: result.page, pageSize: result.pageSize };
  });

  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; title: string } | null>(null);

  const tasks = data?.items ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await fetchJson("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setTitle("");
      // Task mới tạo luôn nằm đầu (sắp xếp mới nhất trước) -> về trang 1 để thấy ngay.
      if (page === 1) await reload();
      else setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo task thất bại");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleDone(id: string, isDone: boolean) {
    setPendingId(id);
    try {
      await fetchJson(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: !isDone }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật task thất bại");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetchJson(`/api/tasks/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xoá task thất bại");
    }
  }

  async function handleSaveEdit(id: string, currentTitle: string) {
    const nextTitle = editDraft.trim();
    if (!nextTitle) {
      setError("Tiêu đề không được để trống");
      return;
    }
    if (nextTitle === currentTitle) {
      setEditingId(null);
      setEditDraft("");
      return;
    }

    setPendingId(id);
    try {
      await fetchJson(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: nextTitle,
          sourceType: "task",
          sourceId: id,
          entityType: "task",
          fieldName: "title",
          wrongValue: currentTitle,
          correctedValue: nextTitle,
          context: { page: "tasks", mode: "manual-edit" },
          // confidence không tự gửi nữa, server tự quyết theo setting "manualCorrectionConfidence" do admin chỉnh.
        }),
      });
      setEditingId(null);
      setEditDraft("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật task thất bại");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Công việc bạn tạo thủ công hoặc AI tạo giúp trong lúc chat.
        </p>
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
            placeholder="Việc cần làm..."
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
      {data !== null && tasks.length === 0 && (
        <EmptyState title="Chưa có task nào" description="Tạo task ở ô phía trên, hoặc nhờ AI tạo giúp trong lúc chat." />
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((t) => (
          <div
            key={t.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-2">
              <label className="flex flex-1 cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={t.isDone}
                  disabled={pendingId === t.id}
                  onChange={() => handleToggleDone(t.id, t.isDone)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {editingId === t.id ? (
                  <div className="flex w-full flex-col gap-2">
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(t.id, t.title)}
                        className="rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                        className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <span
                    className={`font-medium ${
                      t.isDone ? "text-gray-400 line-through dark:text-gray-600" : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {t.title}
                  </span>
                )}
              </label>
              <div className="flex shrink-0 items-center gap-1">
                {editingId !== t.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(t.id);
                      setEditDraft(t.title);
                    }}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                  >
                    Sửa
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmTarget({ id: t.id, title: t.title })}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  Xoá
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              {t.reminderId && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  Có reminder
                </span>
              )}
              <span>{new Date(t.createdAt).toLocaleDateString("vi-VN")}</span>
            </div>
          </div>
        ))}
      </div>

      {data && (
        <PaginationControls page={page} totalPages={totalPages} total={data.total} itemLabel="task" onPageChange={setPage} />
      )}

      <ConfirmModal
        open={confirmTarget !== null}
        title="Xoá task này?"
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
