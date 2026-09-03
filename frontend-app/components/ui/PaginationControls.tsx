"use client";

// Khối "Trang X/Y, N mục" + nút Trước/Sau dùng chung ở 4 trang, tự ẩn khi total=0.
export function PaginationControls({
  page,
  totalPages,
  total,
  itemLabel,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
      <span>
        Trang {page}/{totalPages}
        {itemLabel ? ` — ${total} ${itemLabel}` : ""}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40"
        >
          Trước
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
