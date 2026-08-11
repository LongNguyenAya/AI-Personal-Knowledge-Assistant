"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  taskCount: number;
  reminderCount: number;
};

type UsersResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;

export default function AdminDashboardPage() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chặn race condition khi bấm "Trước"/"Sau" nhanh — cùng pattern ở chat/tasks/reminders. Không
  // cần tự lùi trang khi rỗng như 2 trang kia, vì khoá/xoá mềm không đổi total (user vẫn hiện,
  // chỉ đổi trạng thái).
  const requestSeqRef = useRef(0);
  const loadUsers = useCallback(async (targetPage: number) => {
    const seq = ++requestSeqRef.current;
    try {
      const result = await fetchJson<UsersResponse>(`/api/admin/users?page=${targetPage}&pageSize=${PAGE_SIZE}`);
      if (requestSeqRef.current !== seq) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (requestSeqRef.current !== seq) return;
      setError(err instanceof Error ? err.message : "Không tải được danh sách user");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadUsers(page);
    })();
  }, [page, loadUsers]);

  const userList = data?.users ?? null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function patchUser(id: string, body: Record<string, boolean>) {
    setPendingId(id);
    try {
      await fetchJson(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadUsers(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {data ? `${data.total} tài khoản` : "Đang tải..."}
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
            <tr>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Trạng thái</th>
              <th className="px-5 py-3 font-medium">Ngày tạo</th>
              <th className="px-5 py-3 font-medium text-right">Task</th>
              <th className="px-5 py-3 font-medium text-right">Reminder</th>
              <th className="px-5 py-3 font-medium text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {userList?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                  Chưa có user nào.
                </td>
              </tr>
            )}
            {userList?.map((u) => {
              const isDeleted = !!u.deletedAt;
              return (
                <tr key={u.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-5 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{u.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {isDeleted ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-white dark:bg-gray-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                        Đã xoá
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.isActive
                            ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300"
                            : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-red-500"}`} />
                        {u.isActive ? "Hoạt động" : "Đã khoá"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-500 dark:text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-gray-700 dark:text-gray-300">{u.taskCount}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {u.reminderCount}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {isDeleted ? (
                        <button
                          onClick={() => patchUser(u.id, { softDelete: false })}
                          disabled={pendingId === u.id}
                          className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-green-100 disabled:opacity-50 dark:bg-green-500/10 dark:text-green-300 dark:hover:bg-green-500/20"
                        >
                          {pendingId === u.id ? "Đang xử lý..." : "Khôi phục"}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                            disabled={pendingId === u.id}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                              u.isActive
                                ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                                : "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-300 dark:hover:bg-green-500/20"
                            }`}
                          >
                            {pendingId === u.id ? "..." : u.isActive ? "Khoá" : "Mở khoá"}
                          </button>
                          <button
                            onClick={() => patchUser(u.id, { softDelete: true })}
                            disabled={pendingId === u.id}
                            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            Xoá
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>
            Trang {page}/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
