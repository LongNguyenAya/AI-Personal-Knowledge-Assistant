import AdminHeader from "./_components/admin-header";
import AdminSidebar from "./_components/admin-sidebar";

// Không re-check role ở đây — middleware.ts đã chặn mọi request tới /admin/* nếu không phải
// admin (redirect /login) trước khi layout này kịp render, làm lại là dư thừa.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // h-screen + overflow-hidden ở khung ngoài để KHOÁ cuộn ở cấp trang — nếu không, nội dung dài
  // (vd bảng user nhiều dòng) sẽ đẩy chiều cao cả trang vượt viewport, và trình duyệt cuộn nguyên
  // trang (kéo theo cả header lẫn sidebar) thay vì chỉ cuộn đúng <main>. overflow-y-auto chỉ đặt
  // trên <main> để nó tự thành vùng cuộn RIÊNG, độc lập với header/sidebar đứng yên.
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <AdminHeader />
      {/* flex-col trên mobile — cùng lý do với (main)/layout.tsx: AdminSidebar tự render 1 nút
          "Menu" (không phải sidebar) khi màn hình hẹp, phải xếp chồng lên main thay vì nằm cạnh. */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <AdminSidebar />
        {/* Không còn mx-auto max-w-4xl (896px) bọc children — cùng lý do đã sửa ở (main)/layout.tsx:
            khung quá hẹp so với các layout dạng grid (Dashboard, Prompts) khiến 2 bên trống nhiều,
            đặc biệt trên màn rộng. Trang nào cần tự giới hạn bề rộng thì tự set trong page đó. */}
        <main className="flex-1 overflow-y-auto overflow-x-auto p-8">{children}</main>
      </div>
    </div>
  );
}
