"use client";
import { useEffect, useState } from "react";
import { UploadDropzone } from "@/components/documents/UploadDropzone";
import { fetchJson } from "@/lib/fetch-json";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import type { Document } from "@/types/documents";

const STATUS_STYLE: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  processed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

// Chỉ còn trạng thái tạm thời, sẽ tự chuyển tiếp — dùng để biết có cần tiếp tục poll hay không.
const PENDING_STATUSES = new Set(["uploaded", "processing"]);

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Upload giờ xử lý bất đồng bộ qua SQS (backend-service/workers/document-ingestion-worker.ts),
  // không còn xong ngay trong lúc gọi API upload nữa — tự poll lại trong lúc còn tài liệu ở
  // trạng thái "uploaded"/"processing", dừng poll khi mọi tài liệu đã về trạng thái cuối
  // (processed/failed), tránh gọi API vô thời hạn khi không còn gì thay đổi.
  useEffect(() => {
    const hasPending = documents.some((d) => PENDING_STATUSES.has(d.status));
    if (!hasPending) return;

    const interval = setInterval(() => {
      loadDocuments();
    }, 3000);
    return () => clearInterval(interval);
  }, [documents]);

  async function handleDelete(id: string) {
    try {
      await fetchJson(`/api/documents/${id}`, { method: "DELETE" });
      loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xoá tài liệu thất bại");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tài liệu của tôi</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload tài liệu (.pdf, .txt, .md) để AI tra cứu khi trả lời — PDF sẽ được đọc cả text lẫn hình ảnh/biểu đồ nhúng bên trong.
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
              <span className="truncate font-medium text-gray-900 dark:text-white" title={d.fileName}>
                {d.fileName}
              </span>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_STYLE[d.status] ?? STATUS_STYLE.uploaded
                }`}
              >
                {d.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{new Date(d.createdAt).toLocaleString("vi-VN")}</div>
            <button
              onClick={() => handleDelete(d.id)}
              className="mt-1 self-start rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
            >
              Xoá
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
