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

// Ngưỡng màu thuần hiển thị, không liên quan ngưỡng thật dùng để xếp hạng, chỉ giúp mắt lướt nhanh ghi chú nào "chắc" hơn.
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
  { status: "inactive", label: "Chờ duyệt" },
  { status: "active", label: "Đã duyệt" },
  { status: "dismissed", label: "Đã bỏ qua" },
];

const EMPTY_TITLE: Record<CorrectionStatus, string> = {
  inactive: "Chưa có ghi chú nào chờ duyệt",
  active: "Chưa có ghi chú nào đã duyệt",
  dismissed: "Chưa có ghi chú nào đã bỏ qua",
};

const EMPTY_DESCRIPTION: Record<CorrectionStatus, string> = {
  inactive: "AI sẽ tự đề xuất ghi chú khi gặp tình huống khó xử lý — chưa có gì ở đây cả.",
  active: "Các ghi chú bạn đã duyệt sẽ xuất hiện ở đây.",
  dismissed: "Các ghi chú bạn đã bỏ qua sẽ xuất hiện ở đây.",
};

const PAGE_SIZE = 20;

// Trang duyệt các quan sát AI tự đề xuất, khác correction do người dùng tự sửa có hiệu lực ngay, "Hoàn tác" trả về hàng chờ duyệt.
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

  // Đổi tab phải về trang 1, nếu không có thể lỡ đứng ở trang của tab cũ mà tab mới không đủ trang đó.
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
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setPendingId(null);
    }
  }

  const items = data?.items ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ghi chú AI</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI tự đề xuất các quan sát khi gặp tình huống mơ hồ trong lúc xử lý — chỉ có hiệu lực sau khi bạn duyệt.
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

      {data === null && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}
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
              {/* Dữ liệu này quyết định thứ hạng đưa vào prompt AI (ORDER BY confidence DESC,
                  usageCount DESC) — hiện ra để biết vì sao 1 ghi chú được ưu tiên hơn ghi chú khác. */}
              <span className={`rounded-full px-2 py-0.5 font-medium ${confidenceBadgeStyle(item.confidence)}`}>
                Tin cậy {item.confidence}
                {item.usageCount > 1 ? ` · ×${item.usageCount}` : ""}
              </span>
            </div>
            {/* wrongValue chỉ có ở correction do người dùng tự sửa — ghi chú AI tự đề xuất thì
                không có gì để so sánh nên hiện suông. Diff theo từng từ để chỉ tô đúng chỗ khác. */}
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
                ? new Date(item.createdAt).toLocaleString("vi-VN")
                : `Cập nhật lúc ${new Date(item.updatedAt).toLocaleString("vi-VN")}`}
            </div>
            <div className="flex gap-2">
              {tab === "inactive" ? (
                <>
                  <button
                    onClick={() => patchStatus(item.id, "active")}
                    disabled={pendingId === item.id}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Duyệt
                  </button>
                  <button
                    onClick={() => patchStatus(item.id, "dismissed")}
                    disabled={pendingId === item.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Bỏ qua
                  </button>
                </>
              ) : (
                <button
                  onClick={() => patchStatus(item.id, "inactive")}
                  disabled={pendingId === item.id}
                  title="Đưa ghi chú này trở lại hàng chờ duyệt"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Hoàn tác
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {data && (
        <PaginationControls page={page} totalPages={totalPages} total={data.total} itemLabel="ghi chú" onPageChange={setPage} />
      )}
    </div>
  );
}
