"use client";
import { useEffect, useState } from "react";
import { UploadDropzone } from "@/components/documents/UploadDropzone";
import { fetchJson } from "@/lib/fetch-json";
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
  const [error, setError] = useState<string | null>(null);

  async function loadDocuments() {
    try {
      setDocuments(await fetchJson<Document[]>("/api/documents"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách tài liệu");
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

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-6 flex flex-col gap-2">
        {documents.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Chưa có tài liệu nào.</p>
        )}
        {documents.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div>
              <div className="font-medium text-gray-900 dark:text-white">{d.fileName}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {new Date(d.createdAt).toLocaleString("vi-VN")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_STYLE[d.status] ?? STATUS_STYLE.uploaded
                }`}
              >
                {d.status}
              </span>
              <button
                onClick={() => handleDelete(d.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
