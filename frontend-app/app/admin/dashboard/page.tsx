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
  // Lifts the view state up here instead of letting each AdminMetricChart hold its own, so AdminAnalysisPanel's analysis always matches the current chart.
  const [signupsView, setSignupsView] = useState<View>("week");
  const [aiQueriesView, setAiQueriesView] = useState<View>("week");

  useEffect(() => {
    (async () => {
      try {
        setStats(await fetchJson<AdminStats>("/api/admin/stats"));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load overview stats");
      }
    })();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">System overview.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* lg:items-stretch (grid's default) makes the analysis panel on the right automatically
          match the height of the left column (KPI card + 2 chart blocks combined), no manual height calculation needed. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Deliberately NO "System Health" tile like the reference mockup, the system has no
              uptime/error-rate tracking saved to the DB to compute a real number from, adding one would mean making up data. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total accounts</p>
              <p className="mt-1 bg-gradient-to-r from-indigo-600 to-amber-500 bg-clip-text text-3xl font-extrabold text-transparent">
                {stats ? stats.totalUsers : "N/A"}
              </p>
            </div>
            <div className="rounded-xl border-l-4 border-indigo-600 border-y border-r border-gray-200 bg-white p-4 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Documents processed</p>
              <p className="mt-1 bg-gradient-to-r from-indigo-600 to-amber-500 bg-clip-text text-3xl font-extrabold text-transparent">
                {stats ? stats.indexedDocs : "N/A"}
              </p>
            </div>
            <div className="rounded-xl border-l-4 border-amber-500 border-y border-r border-gray-200 bg-white p-4 shadow-soft transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">AI queries (24h)</p>
              <p className="mt-1 bg-gradient-to-r from-indigo-600 to-amber-500 bg-clip-text text-3xl font-extrabold text-transparent">
                {stats ? stats.aiQueries24h : "N/A"}
              </p>
            </div>
          </div>

          <AdminMetricChart
            title="New users"
            endpoint="/api/admin/stats/signups"
            view={signupsView}
            onViewChange={setSignupsView}
          />
          <AdminMetricChart
            title="AI queries"
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
