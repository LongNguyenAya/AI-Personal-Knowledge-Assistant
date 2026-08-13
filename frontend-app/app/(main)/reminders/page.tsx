"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { RemindersResponse } from "@/types/reminders";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
};
const DEFAULT_STATUS_STYLE = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

const PAGE_SIZE = 20;

export default function RemindersPage() {
  const [data, setData] = useState<RemindersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chặn race condition khi bấm "Trước"/"Sau" liên tiếp nhanh trên mạng chậm — cùng pattern đã
  // dùng ở chat/page.tsx và tasks/page.tsx.
  const requestSeqRef = useRef(0);
  const loadReminders = useCallback(async (targetPage: number) => {
    const seq = ++requestSeqRef.current;
    try {
      const result = await fetchJson<RemindersResponse>(`/api/reminders?page=${targetPage}&pageSize=${PAGE_SIZE}`);
      if (requestSeqRef.current !== seq) return;
      setData(result);
      setError(null);
      // Xoá item cuối cùng của 1 trang (không phải trang 1) -> tự lùi về trang trước thay vì để
      // UI hiện "Trang N/M" trống khó hiểu dù vẫn còn dữ liệu ở trang trước.
      if (result.reminders.length === 0 && result.page > 1 && result.total > 0) {
        setPage(result.page - 1);
      }
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setError(err instanceof Error ? err.message : "Không tải được danh sách reminder");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadReminders(page);
    })();
  }, [page, loadReminders]);

  const reminders = data?.reminders ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // input[type=datetime-local] trả chuỗi không có timezone (vd "2026-08-09T20:00") — gắn
    // cứng +07:00 (giờ VN) trước khi đổi sang UTC, tránh server tự đoán theo giờ máy chủ.
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
      if (page === 1) await loadReminders(1);
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
      await loadReminders(page);
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

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-2">
        {reminders.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Chưa có reminder nào.</p>
        )}
        {reminders.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{r.title}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{new Date(r.dueAt).toLocaleString("vi-VN")}</span>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span>{r.source}</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${
                    STATUS_STYLE[r.status] ?? DEFAULT_STATUS_STYLE
                  }`}
                >
                  {r.status}
                </span>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span>Tạo lúc {new Date(r.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(r.id)}
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
            Trang {page}/{totalPages} — {data.total} reminder
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
