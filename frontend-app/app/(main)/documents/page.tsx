"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { UploadDropzone } from "@/components/documents/UploadDropzone";
import { fetchJson } from "@/lib/fetch-json";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { HoverDetail } from "@/components/ui/HoverDetail";
import { CHAT_PREFILL_STORAGE_KEY } from "@/lib/chat-prefill";
import { useWsEvent, useWsConnected } from "@/components/WsProvider";
import type { Document } from "@/types/documents";

type RelatedDocument = { documentId: string; fileName: string };

const STATUS_STYLE: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  processed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

// Chỉ còn trạng thái tạm thời, sẽ tự chuyển tiếp, dùng để biết có cần tiếp tục poll hay không.
const PENDING_STATUSES = new Set(["uploaded", "processing"]);

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; fileName: string } | null>(null);

  // Tài liệu liên quan chỉ tính khi user thực sự mở ra xem, và cache lại để mở/đóng lại không gọi API lần nữa.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [relatedCache, setRelatedCache] = useState<Record<string, RelatedDocument[]>>({});
  const [relatedLoadingId, setRelatedLoadingId] = useState<string | null>(null);

  async function toggleRelated(documentId: string) {
    if (expandedId === documentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(documentId);
    if (relatedCache[documentId]) return;

    setRelatedLoadingId(documentId);
    try {
      const related = await fetchJson<RelatedDocument[]>(`/api/documents/${documentId}/related`);
      setRelatedCache((prev) => ({ ...prev, [documentId]: related }));
    } catch {
      setRelatedCache((prev) => ({ ...prev, [documentId]: [] }));
    } finally {
      setRelatedLoadingId(null);
    }
  }

  function goCompare(fileNameA: string, fileNameB: string) {
    sessionStorage.setItem(CHAT_PREFILL_STORAGE_KEY, `So sánh tài liệu "${fileNameA}" và "${fileNameB}"`);
    router.push("/chat");
  }

  async function loadDocuments() {
    try {
      setDocuments(await fetchJson<Document[]>("/api/documents"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách tài liệu");
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    (async () => {
      await loadDocuments();
    })();
  }, []);

  // Worker đẩy WS ngay khi đổi trạng thái nên bình thường không cần poll, chỉ tự poll khi WS đang không kết nối.
  const wsConnected = useWsConnected();
  useWsEvent((event) => {
    if (event.type === "document_status") loadDocuments();
  });

  useEffect(() => {
    const hasPending = documents.some((d) => PENDING_STATUSES.has(d.status));
    if (!hasPending || wsConnected) return;

    const interval = setInterval(() => {
      loadDocuments();
    }, 3000);
    return () => clearInterval(interval);
  }, [documents, wsConnected]);

  async function handleDelete(id: string) {
    try {
      await fetchJson(`/api/documents/${id}`, { method: "DELETE" });
      loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xoá tài liệu thất bại");
    }
  }

  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Không upload lại file, chỉ gửi lại đúng tài liệu đã có vào hàng đợi xử lý (xem route retry).
  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      await fetchJson(`/api/documents/${id}/retry`, { method: "POST" });
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thử lại thất bại");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tài liệu của tôi</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload tài liệu (.pdf, .docx, .pptx, .txt, .md, .png, .jpg, .webp) để AI tra cứu khi trả lời — PDF và ảnh sẽ được đọc cả chữ lẫn hình ảnh/biểu đồ nhúng bên trong.
        </p>
      </div>

      <UploadDropzone onUploaded={loadDocuments} />

      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      {!loaded && <p className="mt-6 text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}
      {loaded && documents.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Chưa có tài liệu nào" description="Upload tài liệu ở khung phía trên để bắt đầu." />
        </div>
      )}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {documents.map((d) => (
          <div
            key={d.id}
            className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-soft dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-start justify-between gap-2">
              {d.status === "processed" ? (
                <Link
                  href={`/documents/${d.id}`}
                  className="truncate font-medium text-gray-900 hover:text-indigo-600 hover:underline dark:text-white dark:hover:text-indigo-400"
                  title={d.fileName}
                >
                  {d.fileName}
                </Link>
              ) : (
                <span className="truncate font-medium text-gray-900 dark:text-white" title={d.fileName}>
                  {d.fileName}
                </span>
              )}
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_STYLE[d.status] ?? STATUS_STYLE.uploaded
                }`}
              >
                {d.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(d.createdAt).toLocaleString("vi-VN")}</div>

            {d.flaggedSuspicious && (
              <HoverDetail content={d.flagReason ?? "Không có chi tiết cụ thể."}>
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Phát hiện dấu hiệu bất thường trong nội dung — AI sẽ hạ độ tin cậy khi trích từ tài liệu này.</span>
                </div>
              </HoverDetail>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmTarget({ id: d.id, fileName: d.fileName })}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                Xoá
              </button>
              {d.status === "processed" && (
                <button
                  onClick={() => toggleRelated(d.id)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                >
                  {expandedId === d.id ? "Ẩn tài liệu liên quan" : "Tài liệu liên quan"}
                </button>
              )}
              {d.status === "failed" && (
                <button
                  onClick={() => handleRetry(d.id)}
                  disabled={retryingId === d.id}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                >
                  {retryingId === d.id ? "Đang gửi lại..." : "Thử lại"}
                </button>
              )}
            </div>

            {expandedId === d.id && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5 text-xs dark:border-gray-800 dark:bg-gray-950/40">
                {relatedLoadingId === d.id && <p className="text-gray-400 dark:text-gray-500">Đang tìm...</p>}
                {relatedLoadingId !== d.id && (relatedCache[d.id]?.length ?? 0) === 0 && (
                  <p className="text-gray-400 dark:text-gray-500">Không tìm thấy tài liệu nào đủ liên quan.</p>
                )}
                {relatedLoadingId !== d.id && relatedCache[d.id] && relatedCache[d.id].length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {relatedCache[d.id].map((r) => (
                      <div key={r.documentId} className="flex items-center justify-between gap-2">
                        <span className="truncate text-gray-700 dark:text-gray-300" title={r.fileName}>
                          {r.fileName}
                        </span>
                        <button
                          onClick={() => goCompare(d.fileName, r.fileName)}
                          className="shrink-0 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          So sánh
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <ConfirmModal
        open={confirmTarget !== null}
        title="Xoá tài liệu này?"
        description={confirmTarget ? `"${confirmTarget.fileName}" và toàn bộ nội dung đã lập chỉ mục sẽ bị xoá vĩnh viễn, không thể hoàn tác.` : ""}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (confirmTarget) handleDelete(confirmTarget.id);
          setConfirmTarget(null);
        }}
      />
    </div>
  );
}
