import AdminHeader from "./_components/admin-header";
import AdminSidebar from "./_components/admin-sidebar";

// Không re-check role ở đây vì middleware.ts đã chặn mọi request tới /admin/* nếu không phải admin trước khi render.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // h-screen + overflow-hidden ở khung ngoài để khoá cuộn cấp trang, overflow-y-auto chỉ đặt trên <main> để nó tự cuộn riêng.
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
