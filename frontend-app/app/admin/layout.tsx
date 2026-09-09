import AdminHeader from "./_components/admin-header";
import AdminSidebar from "./_components/admin-sidebar";

// Doesn't re-check the role here since middleware.ts already blocks every request to /admin/* before rendering if not an admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // h-screen + overflow-hidden on the outer frame locks page-level scrolling, overflow-y-auto is only set on <main> so it scrolls independently.
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <AdminHeader />
      {/* flex-col trên mobile — cùng lý do với (main)/layout.tsx: AdminSidebar tự render 1 nút
          "Menu" (không phải sidebar) khi màn hình hẹp, phải xếp chồng lên main thay vì nằm cạnh. */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <AdminSidebar />
        {/* Không còn mx-auto max-w-4xl bọc children — khung quá hẹp so với layout dạng grid
            (Dashboard, Prompts). Trang nào cần tự giới hạn bề rộng thì tự set trong page đó. */}
        <main className="flex-1 overflow-y-auto overflow-x-auto p-8">{children}</main>
      </div>
    </div>
  );
}
