"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { AdminMetricChart, type View } from "@/components/admin/AdminMetricChart";
import { AdminAnalysisPanel } from "@/components/admin/AdminAnalysisPanel";
import type { AdminStats } from "@/types/admin";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Nâng state view lên đây (thay vì để mỗi AdminMetricChart tự giữ) — AdminAnalysisPanel cần biết
  // đang xem đúng khoảng thời gian nào của từng khối để phân tích luôn khớp với biểu đồ hiện tại.
  const [signupsView, setSignupsView] = useState<View>("week");
  const [aiQueriesView, setAiQueriesView] = useState<View>("week");

  useEffect(() => {
    (async () => {
      try {
        setStats(await fetchJson<AdminStats>("/api/admin/stats"));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được số liệu tổng quan");
      }
    })();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Tổng quan hệ thống.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* lg:items-stretch (mặc định của grid) khiến panel phân tích bên phải tự cao bằng đúng cột
          trái (KPI card + 2 khối biểu đồ cộng lại) — không cần tính chiều cao thủ công. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Cố tình KHÔNG có ô "System Health" như ảnh mẫu — hệ thống chưa có cơ chế theo dõi
              uptime/tỷ lệ lỗi nào lưu vào DB để tính ra con số thật, thêm vào sẽ phải bịa số liệu. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Tổng tài khoản</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{stats ? stats.totalUsers : "—"}</p>
            </div>
            <div className="rounded-xl border-l-4 border-indigo-600 border-y border-r border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Tài liệu đã xử lý xong</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{stats ? stats.indexedDocs : "—"}</p>
            </div>
            <div className="rounded-xl border-l-4 border-amber-500 border-y border-r border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Lượt hỏi AI (24h)</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{stats ? stats.aiQueries24h : "—"}</p>
            </div>
          </div>

          <AdminMetricChart
            title="Người dùng mới"
            endpoint="/api/admin/stats/signups"
            view={signupsView}
            onViewChange={setSignupsView}
          />
          <AdminMetricChart
            title="Lượt hỏi AI"
            endpoint="/api/admin/stats/ai-queries"
            view={aiQueriesView}
            onViewChange={setAiQueriesView}
          />
        </div>

        <div className="lg:col-span-1">
          <AdminAnalysisPanel signupsView={signupsView} aiQueriesView={aiQueriesView} />
        </div>
      </div>
    </div>
  );
}
