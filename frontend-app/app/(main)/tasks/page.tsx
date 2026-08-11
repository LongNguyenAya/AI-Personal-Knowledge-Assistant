"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

type Task = {
  id: string;
  title: string;
  isDone: boolean;
  reminderId: string | null;
  createdAt: string;
};

type TasksResponse = {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;

export default function TasksPage() {
  const [data, setData] = useState<TasksResponse | null>(null);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chặn race condition khi bấm "Trước"/"Sau" nhanh trên mạng chậm — response trang N có thể về
  // sau response trang M, chỉ áp dụng nếu nó vẫn là request mới nhất lúc hoàn thành. Cùng
  // pattern ở chat/page.tsx.
  const requestSeqRef = useRef(0);
  const loadTasks = useCallback(async (targetPage: number) => {
    const seq = ++requestSeqRef.current;
    try {
      const result = await fetchJson<TasksResponse>(`/api/tasks?page=${targetPage}&pageSize=${PAGE_SIZE}`);
      if (requestSeqRef.current !== seq) return;
      setData(result);
      setError(null);
      // Xoá item cuối cùng của 1 trang (không phải trang 1) -> trang đó rỗng dù vẫn còn dữ liệu ở
      // trang trước. Tự lùi về trang trước thay vì để UI hiện "Trang N/M" trống khó hiểu.
      if (result.tasks.length === 0 && result.page > 1 && result.total > 0) {
        setPage(result.page - 1);
      }
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setError(err instanceof Error ? err.message : "Không tải được danh sách task");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadTasks(page);
    })();
  }, [page, loadTasks]);

  const tasks = data?.tasks ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

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
      if (page === 1) await loadTasks(1);
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
      await loadTasks(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật task thất bại");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetchJson(`/api/tasks/${id}`, { method: "DELETE" });
      await loadTasks(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xoá task thất bại");
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

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        {tasks.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">Chưa có task nào.</p>}
        {tasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <label className="flex flex-1 items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={t.isDone}
                disabled={pendingId === t.id}
                onChange={() => handleToggleDone(t.id, t.isDone)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span
                className={`font-medium ${
                  t.isDone ? "text-gray-400 line-through dark:text-gray-600" : "text-gray-900 dark:text-white"
                }`}
              >
                {t.title}
              </span>
              {t.reminderId && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                  Có reminder
                </span>
              )}
            </label>
            <span className="mr-4 text-xs text-gray-400 dark:text-gray-500">
              {new Date(t.createdAt).toLocaleDateString("vi-VN")}
            </span>
            <button
              onClick={() => handleDelete(t.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              Xoá
            </button>
          </div>
        ))}
      </div>

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Trang {page}/{totalPages} — {data.total} task
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
