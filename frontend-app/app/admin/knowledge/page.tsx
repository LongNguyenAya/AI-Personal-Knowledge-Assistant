"use client";
import { useEffect, useState, useCallback } from "react";
import { fetchJson } from "@/lib/fetch-json";
import type { KnowledgeNote } from "@/types/admin";

const TABS: { status: KnowledgeNote["status"]; label: string }[] = [
  { status: "pending", label: "Chờ duyệt" },
  { status: "approved", label: "Đã duyệt" },
  { status: "rejected", label: "Từ chối" },
  { status: "revoked", label: "Đã thu hồi" },
];

export default function AdminKnowledgePage() {
  const [tab, setTab] = useState<KnowledgeNote["status"]>("pending");
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status: KnowledgeNote["status"]) => {
    try {
      const data = await fetchJson<KnowledgeNote[]>(`/api/admin/knowledge?status=${status}`);
      setNotes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách ghi chú");
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function review(id: string, decision: "approved" | "rejected" | "revoked") {
    setBusyId(id);
    try {
      await fetchJson(`/api/admin/knowledge/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      await load(tab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Knowledge base</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ghi chú do agent tự đề xuất — chỉ có hiệu lực (agent dùng để trả lời) sau khi được duyệt tại đây.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
        Cảnh báo: ghi chú sau khi duyệt sẽ hiển thị cho MỌI user — kiểm tra kỹ nội dung không chứa tên, email, hay thông tin cá nhân của bất kỳ ai trước khi duyệt.
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.status}
            onClick={() => setTab(t.status)}
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

      <div className="flex flex-col gap-3">
        {notes.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">Không có ghi chú nào.</p>}
        {notes.map((n) => (
          <div
            key={n.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {n.path}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(n.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{n.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">{n.content}</p>

            <div className="mt-3 flex justify-end gap-2">
              {n.status === "pending" && (
                <>
                  <button
                    onClick={() => review(n.id, "rejected")}
                    disabled={busyId === n.id}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => review(n.id, "approved")}
                    disabled={busyId === n.id}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Duyệt
                  </button>
                </>
              )}
              {n.status === "approved" && (
                <button
                  onClick={() => review(n.id, "revoked")}
                  disabled={busyId === n.id}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Thu hồi
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
