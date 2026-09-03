import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import CommandPalette from "@/components/CommandPalette";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// subsets "vietnamese" bắt buộc vì font này được chọn riêng để hỗ trợ tốt dấu tiếng Việt, thiếu subset chữ có dấu sẽ rơi về font mặc định.
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
      className={`${beVietnamPro.variable} h-full scroll-smooth antialiased`}
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
        <CommandPalette />
      </body>
    </html>
  );
}
