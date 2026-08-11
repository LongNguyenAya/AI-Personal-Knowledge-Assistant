import AdminNav from "./_components/admin-nav";

// Không re-check role ở đây — middleware.ts đã chặn mọi request tới /admin/* nếu không phải
// admin (redirect /login) trước khi layout này kịp render, làm lại là dư thừa.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            AI Knowledge Assistant
          </p>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        </div>
        <AdminNav />
      </aside>
      <main className="flex-1 overflow-x-auto p-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
