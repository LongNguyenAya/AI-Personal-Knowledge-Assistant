export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

export function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return mode === "dark";
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", resolveIsDark(mode));
}

// Dùng làm chuỗi script nhúng thẳng vào <head> (xem app/layout.tsx) — PHẢI chạy đồng bộ trước khi
// React hydrate, nếu không màn hình sẽ nháy sai theme 1 khoảnh khắc (đọc theme sau khi đã render
// xong theo mặc định sáng). Vì chạy trước khi bundle JS tải xong nên không thể import trực tiếp
// hàm applyTheme ở trên — phải lặp lại logic dưới dạng chuỗi thuần, KHÔNG dùng chung code được.
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
