"use client";
import { useEffect, useState } from "react";
import { applyTheme, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

const LABELS: Record<ThemeMode, string> = { light: "Sáng", dark: "Tối", system: "Hệ thống" };
const NEXT: Record<ThemeMode, ThemeMode> = { light: "dark", dark: "system", system: "light" };

export default function ThemeToggle() {
  // Khởi tạo null (chưa biết) thay vì đoán 'system' — script chạy trước hydrate (xem
  // THEME_INIT_SCRIPT) đã set đúng class .dark rồi, effect dưới chỉ cần ĐỌC LẠI localStorage để
  // đồng bộ label hiển thị, không tự áp lại theme (tránh nháy/ghi đè khác với script init).
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const saved = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null) ?? "system";
    setMode(saved);
  }, []);

  // Theme 'system' cần tự cập nhật khi user đổi setting hệ điều hành NGAY LÚC đang mở app — nếu
  // không nghe sự kiện này, phải tải lại trang mới thấy app đổi theo.
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  function handleClick() {
    const next = NEXT[mode ?? "system"];
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    setMode(next);
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
      aria-label="Đổi giao diện sáng/tối"
    >
      {/* mode=null (chưa đọc xong localStorage) chỉ xảy ra trong 1 nhịp render đầu — hiện tạm
          "Hệ thống" (mặc định thật của app) thay vì để trống, tránh nháy chữ. */}
      {LABELS[mode ?? "system"]}
    </button>
  );
}
