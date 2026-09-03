"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

// Trang đã có chỗ đặt riêng (navbar, sidebar) thì không hiện thêm bản nổi, tránh trùng 2 nút.
const HAS_OWN_PLACEMENT_PREFIXES = ["/chat", "/documents", "/tasks", "/reminders", "/digest", "/corrections", "/settings", "/admin"];

export default function ThemeToggle({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const pathname = usePathname();
  // Khởi tạo null vì THEME_INIT_SCRIPT đã set đúng class .dark trước hydrate, effect dưới chỉ đọc lại để đồng bộ nút.
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const initial: ThemeMode = saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setMode(initial);
  }, []);

  function handleClick() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    setMode(next);
  }

  // Đặt sau mọi hook (Rules of Hooks), return sớm trước đó sẽ khiến React báo "Rendered fewer hooks than expected".
  const hasOwnPlacement = pathname === "/" || HAS_OWN_PLACEMENT_PREFIXES.some((p) => pathname?.startsWith(p));
  if (variant === "floating" && hasOwnPlacement) return null;

  // isDark=false khi mode=null (nhịp render đầu, chưa đọc xong localStorage), khớp mặc định sáng của app để tránh nháy nút.
  const isDark = mode === "dark";

  return (
    <button
      onClick={handleClick}
      aria-label="Đổi giao diện sáng/tối"
      className={variant === "floating" ? "fixed right-4 bottom-4 z-50" : undefined}
    >
      {/* Track — nền gradient nhạt cố định (không đổi theo trạng thái), chỉ viên tròn bên trong
          trượt qua lại và đổi màu. */}
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-gray-200 bg-gradient-to-br from-indigo-600/15 to-amber-500/15 dark:border-gray-700">
        <span
          className={`absolute left-0.5 h-5 w-5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 ${
            isDark ? "translate-x-5 bg-gradient-to-br from-amber-500 to-orange-500" : "translate-x-0 bg-gradient-to-br from-indigo-600 to-indigo-500"
          }`}
        />
      </span>
    </button>
  );
}
