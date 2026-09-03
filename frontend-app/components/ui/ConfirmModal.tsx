"use client";
import { AlertTriangle } from "lucide-react";

// Thay cho confirm() mặc định của trình duyệt, trước đây các nút xoá hoàn toàn không có bước xác nhận nào.
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Xoá",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-[420px] rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-gradient-to-br from-red-400 to-red-500 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(239,68,68,0.35)] transition-opacity hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
