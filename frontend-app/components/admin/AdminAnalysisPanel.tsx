"use client";
import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Markdown } from "@/components/ui/Markdown";
import type { View } from "./AdminMetricChart";

type Metric = "signups" | "ai-queries";
type Analysis = { analysisText: string; createdAt: string };

const METRICS: { value: Metric; label: string }[] = [
  { value: "signups", label: "Người dùng" },
  { value: "ai-queries", label: "Lượt hỏi" },
];

// Panel dùng chung cho cả 2 khối, chọn metric bằng nút lọc thay vì lặp nút "Phân tích" riêng, `view` nhận từ component cha.
export function AdminAnalysisPanel({ signupsView, aiQueriesView }: { signupsView: View; aiQueriesView: View }) {
  const [metric, setMetric] = useState<Metric>("signups");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const view = metric === "signups" ? signupsView : aiQueriesView;
  const endpoint = `/api/admin/stats/${metric}/analyze`;

  useEffect(() => {
    setAnalysis(null);
    setError(null);
    (async () => {
      try {
        // Chỉ đọc kết quả đã lưu từ lần bấm gần nhất, không tự chạy AI mới khi đổi metric/view.
        setAnalysis(await fetchJson<Analysis | null>(`${endpoint}?view=${view}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được kết quả phân tích");
      }
    })();
  }, [metric, view, endpoint]);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      setAnalysis(
        await fetchJson<Analysis>(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ view }),
        })
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Phân tích thất bại");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-soft dark:border-gray-800 dark:bg-gray-900">
      <h3 className="font-semibold text-gray-900 dark:text-white">Phân tích</h3>

      <div className="mt-3 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {METRICS.map((m) => (
          <button
            key={m.value}
            onClick={() => setMetric(m.value)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              metric === m.value
                ? "bg-indigo-600 text-white"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={analyzing}
        className="mt-4 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
      >
        {analyzing ? "Đang phân tích..." : analysis ? "Phân tích lại" : "Phân tích"}
      </button>

      <div className="mt-4 flex-1">
        {analysis ? (
          <div className="rounded-lg border-l-2 border-indigo-600 bg-white p-3 dark:bg-gray-900">
            <p className="mb-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">AI Knowledge Assistant</p>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <Markdown text={analysis.analysisText} />
            </div>
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Phân tích lúc {new Date(analysis.createdAt).toLocaleString("vi-VN")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Chưa có phân tích nào cho "{METRICS.find((m) => m.value === metric)?.label}" ở khoảng thời gian này — bấm "Phân
            tích" để AI đọc biểu đồ hiện tại và viết nhận xét.
          </p>
        )}
      </div>
    </div>
  );
}
