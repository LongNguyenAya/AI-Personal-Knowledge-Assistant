"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type PagedData<T> = { items: T[]; total: number; page: number; pageSize: number };

// Gộp logic lặp lại ở tasks/reminders/admin-users/corrections, tự lùi về trang trước khi trang hiện tại rỗng, `deps` cho fetcher đóng gói thêm state.
export function usePagedFetch<T>(fetcher: (page: number) => Promise<PagedData<T>>, deps: unknown[] = []) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedData<T> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestSeqRef = useRef(0);
  const load = useCallback(
    async (targetPage: number) => {
      const seq = ++requestSeqRef.current;
      try {
        const result = await fetcher(targetPage);
        if (requestSeqRef.current !== seq) return;
        setData(result);
        setError(null);
        if (result.items.length === 0 && result.page > 1 && result.total > 0) {
          setPage(result.page - 1);
        }
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setError(err instanceof Error ? err.message : "Không tải được dữ liệu");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reload = useCallback(() => load(page), [load, page]);

  return { page, setPage, data, error, setError, totalPages, reload };
}
