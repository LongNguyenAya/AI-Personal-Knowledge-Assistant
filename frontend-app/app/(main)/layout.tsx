import MainNav from "./_components/main-nav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // flex-col trên mobile — MainNav tự render 1 thanh top-bar (không phải sidebar) khi màn hình hẹp,
  // phải xếp CHỒNG lên trên <main> thay vì nằm CẠNH (flex-row) như ở md+, nếu không thanh top-bar
  // sẽ bị đẩy thành 1 cột hẹp đứng cạnh main do là flex item cùng hàng.
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 md:flex-row dark:bg-gray-950">
      <MainNav />
      {/* Không giới hạn max-width ở đây nữa — trang chat cần dùng hết chiều rộng còn lại (đúng bố
          cục trong ảnh mẫu), trong khi các trang danh sách đơn giản (tasks/reminders/documents) tự
          giới hạn max-w-4xl ngay trong chính file của chúng, vì chỉ những trang đó mới cần đọc dễ
          hơn khi bị bó hẹp lại. */}
      <main className="flex-1 overflow-x-auto px-6 py-8">{children}</main>
    </div>
  );
}
