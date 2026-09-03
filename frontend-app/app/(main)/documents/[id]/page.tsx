"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { CHAT_PREFILL_STORAGE_KEY } from "@/lib/chat-prefill";

type DocumentContent = {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  flaggedSuspicious: boolean;
  flagReason: string | null;
  content: string;
};

type RelatedDocument = { documentId: string; fileName: string };

const STATUS_STYLE: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
  processed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

// Xem lại toàn bộ nội dung đã trích xuất ngay trong app, thay vì phải hỏi qua Chat để AI trả về 1 đoạn liên quan.
export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentContent | null>(null);
  const [related, setRelated] = useState<RelatedDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [docData, relatedData] = await Promise.all([
          fetchJson<DocumentContent>(`/api/documents/${params.id}/content`),
          fetchJson<RelatedDocument[]>(`/api/documents/${params.id}/related`),
        ]);
        setDoc(docData);
        setRelated(relatedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được tài liệu");
      }
    })();
  }, [params.id]);

  function goCompare(fileNameB: string) {
    if (!doc) return;
    sessionStorage.setItem(CHAT_PREFILL_STORAGE_KEY, `So sánh tài liệu "${doc.fileName}" và "${fileNameB}"`);
    router.push("/chat");
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/documents" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Quay lại danh sách tài liệu
      </Link>

      {error && <ErrorBanner message={error} />}

      {!doc && !error && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tải...</p>}

      {doc && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{doc.fileName}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[doc.status] ?? STATUS_STYLE.uploaded}`}>
              {doc.status}
            </span>
          </div>
          <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">Tải lên lúc {new Date(doc.createdAt).toLocaleString("vi-VN")}</p>

          {doc.flaggedSuspicious && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{doc.flagReason ?? "Phát hiện dấu hiệu bất thường trong nội dung."}</span>
            </div>
          )}

          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-soft dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Nội dung đã trích xuất</h2>
            {doc.content.trim().length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {doc.status === "processed" ? "Chưa có nội dung nào." : "Tài liệu chưa xử lý xong, chưa có nội dung để xem."}
              </p>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">{doc.content}</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Tài liệu liên quan</h2>
            {related === null && <p className="text-sm text-gray-400 dark:text-gray-500">Đang tìm...</p>}
            {related !== null && related.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">Không tìm thấy tài liệu nào đủ liên quan.</p>
            )}
            {related && related.length > 0 && (
              <div className="flex flex-col gap-2">
                {related.map((r) => (
                  <div key={r.documentId} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/documents/${r.documentId}`} className="truncate text-gray-700 hover:underline dark:text-gray-300" title={r.fileName}>
                      {r.fileName}
                    </Link>
                    <button
                      onClick={() => goCompare(r.fileName)}
                      className="shrink-0 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      So sánh
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
