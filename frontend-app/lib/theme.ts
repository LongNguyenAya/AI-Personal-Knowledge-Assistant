// Bỏ "system", chỉ còn đúng 2 trạng thái sáng/tối gạt trực tiếp qua nút switch, theo yêu cầu người dùng.
export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

// Chuỗi script nhúng vào <head>, phải chạy đồng bộ trước hydrate nên lặp lại logic applyTheme, vẫn tôn trọng theme hệ điều hành lần đầu.
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');var d=m?m==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
