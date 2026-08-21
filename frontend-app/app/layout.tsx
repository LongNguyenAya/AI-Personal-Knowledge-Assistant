import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// subsets "vietnamese" bắt buộc — font này được DESIGN.md chọn riêng vì hỗ trợ tốt dấu tiếng Việt,
// thiếu subset này chữ có dấu sẽ tự rơi về font hệ thống mặc định.
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Personal Knowledge Assistant",
  description: "Trợ lý AI đa tác vụ: tra cứu tài liệu, tạo task/reminder, chat có ngữ cảnh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${beVietnamPro.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Chạy đồng bộ trước khi React hydrate — set đúng class .dark ngay từ frame đầu tiên,
            tránh nháy sai theme (xem giải thích chi tiết ở THEME_INIT_SCRIPT, lib/theme.ts). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
