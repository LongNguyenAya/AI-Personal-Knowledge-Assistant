import MainNav from "./_components/main-nav";
import { WsProvider } from "@/components/WsProvider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // flex-col trên mobile để MainNav xếp chồng lên <main>, h-screen chốt cứng 100vh, WsProvider đặt ở đây vì WS chỉ cần cho khu vực đã đăng nhập.
  return (
    <WsProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-gray-50 md:flex-row dark:bg-gray-950">
        <MainNav />
        {/* Không giới hạn max-width ở đây — trang chat cần dùng hết chiều rộng còn lại, còn các
            trang danh sách (tasks/reminders/documents) tự giới hạn max-w-4xl trong chính file chúng. */}
        <main className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </WsProvider>
  );
}
