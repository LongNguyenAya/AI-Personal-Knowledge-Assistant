"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { ChartBlock } from "@/components/chat/ChartBlock";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { ChartDatum, ChartTrend } from "@ai-assistant/shared-types";

export type View = "week" | "month" | "year";
type SeriesResponse = {
  data: ChartDatum[];
  trend: ChartTrend | null;
  trendMessage: string | null;
  outliers: ChartDatum[];
  movingAverage: number[] | null;
  softForecast: { points: number[]; labels: string[] } | null;
};
type CompareResponse = { current: number; previous: number; changePercent: number | null };

const VIEWS: { value: View; label: string }[] = [
  { value: "week", label: "7 ngày" },
  { value: "month", label: "1 tháng" },
  { value: "year", label: "1 năm" },
];

// Chỉ còn phần biểu đồ/so sánh, phần phân tích AI đã tách sang AdminAnalysisPanel.tsx, `view`/`onViewChange` do component cha quản lý.
export function AdminMetricChart({
  title,
  endpoint,
  view,
  onViewChange,
}: {
  title: string;
  endpoint: string;
  view: View;
  onViewChange: (view: View) => void;
}) {
  const [series, setSeries] = useState<SeriesResponse | null>(null);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSeries(null);
    setCompare(null);
    setError(null);
    (async () => {
      try {
        if (view === "month") {
          setCompare(await fetchJson<CompareResponse>(`${endpoint}?view=month`));
        } else {
          setSeries(await fetchJson<SeriesResponse>(`${endpoint}?view=${view}`));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được số liệu");
      }
    })();
  }, [view, endpoint]);

  const isEmpty = series !== null && series.data.every((d) => d.value === 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <div className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              onClick={() => onViewChange(v.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v.value
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* min-h cố định theo trường hợp cao nhất — tránh card nhảy layout khi đổi tab giữa view
          "1 tháng" (ngắn) và "7 ngày"/"1 năm" (biểu đồ SVG). Căn giữa dọc cho nội dung ngắn. */}
      <div className="flex min-h-[340px] flex-col justify-center">
        {view === "month" ? (
          compare ? (
            <div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tháng này</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{compare.current}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tháng trước</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{compare.previous}</p>
                </div>
              </div>
              <p
                className={`mt-3 text-xs font-medium ${
                  compare.changePercent === null
                    ? "text-gray-400 dark:text-gray-500"
                    : compare.changePercent >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                }`}
              >
                {compare.changePercent === null
                  ? "Mới — chưa có dữ liệu tháng trước để so sánh"
                  : `${compare.changePercent >= 0 ? "+" : ""}${compare.changePercent}% so với tháng trước`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>
          )
        ) : series === null ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>
        ) : isEmpty ? (
          <EmptyState title="Chưa có dữ liệu trong khoảng thời gian này" />
        ) : (
          <ChartBlock
            chartType="line"
            xAxisType="time"
            data={series.data}
            trend={series.trend}
            trendMessage={series.trendMessage}
            outliers={series.outliers}
            movingAverage={series.movingAverage}
            softForecast={series.softForecast}
          />
        )}
      </div>
    </div>
  );
}
