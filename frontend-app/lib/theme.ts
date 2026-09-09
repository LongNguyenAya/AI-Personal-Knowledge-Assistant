// Dropped "system", only 2 states left (light/dark) toggled directly via the switch, per the user's request.
export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

// A script string embedded in <head>, must run synchronously before hydration so it repeats the applyTheme logic, still respects the OS theme on first load.
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');var d=m?m==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
