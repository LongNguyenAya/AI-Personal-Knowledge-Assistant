"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";

type WeeklyDigest = {
  id: string;
  weekStart: string;
  weekEnd: string;
  summaryText: string;
  stats: {
    documentsProcessed: number;
    tasksCompleted: number;
    tasksOverdue: number;
    conversationsStarted: number;
  };
  createdAt: string;
};

// Không có form tạo mới ở trang này, digest chỉ do digest-worker.ts tự tạo theo lịch hàng tuần, trang này thuần đọc lại lịch sử.
export default function DigestPage() {
  const [digests, setDigests] = useState<WeeklyDigest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchJson<WeeklyDigest[]>("/api/digests");
        setDigests(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được danh sách tóm tắt");
      }
    })();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tóm tắt tuần</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI tự động tổng hợp hoạt động của bạn mỗi tuần — tài liệu, task, cuộc trò chuyện.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {digests === null && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}
      {digests !== null && digests.length === 0 && (
        <EmptyState
          title="Chưa có bản tóm tắt nào"
          description="Bản tóm tắt đầu tiên sẽ xuất hiện sau khi bạn có hoạt động trong 1 tuần trọn vẹn."
        />
      )}

      <div className="flex flex-col gap-4">
        {digests?.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border-l-2 border-indigo-600 bg-white p-5 shadow-soft dark:bg-gray-900"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">AI Knowledge Assistant</p>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(d.weekStart).toLocaleDateString("vi-VN")} – {new Date(d.weekEnd).toLocaleDateString("vi-VN")}
              </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-100">{d.summaryText}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {d.stats.documentsProcessed > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {d.stats.documentsProcessed} tài liệu
                </span>
              )}
              {d.stats.tasksCompleted > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {d.stats.tasksCompleted} task hoàn thành
                </span>
              )}
              {d.stats.tasksOverdue > 0 && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  {d.stats.tasksOverdue} task quá hạn
                </span>
              )}
              {d.stats.conversationsStarted > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {d.stats.conversationsStarted} cuộc trò chuyện mới
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
