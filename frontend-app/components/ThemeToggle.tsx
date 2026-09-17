"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { applyTheme, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";

// A page that already places one itself (navbar, sidebar) doesn't get an extra floating one too, avoiding 2 duplicate buttons.
const HAS_OWN_PLACEMENT_PREFIXES = ["/chat", "/documents", "/tasks", "/reminders", "/digest", "/corrections", "/settings", "/admin"];

export default function ThemeToggle({ variant = "floating" }: { variant?: "floating" | "inline" }) {
  const pathname = usePathname();
  // Initialized to null since THEME_INIT_SCRIPT already sets the .dark class correctly before hydration, the effect below just reads it back to sync the button.
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

  // Placed after every hook (Rules of Hooks), an early return before this would make React report "Rendered fewer hooks than expected".
  const hasOwnPlacement = pathname === "/" || HAS_OWN_PLACEMENT_PREFIXES.some((p) => pathname?.startsWith(p));
  if (variant === "floating" && hasOwnPlacement) return null;

  // isDark=false when mode=null (the first render pass, before localStorage has been read), matching the app's light default to avoid a flash of the button.
  const isDark = mode === "dark";

  return (
    <button
      onClick={handleClick}
      aria-label="Toggle light/dark theme"
      className={variant === "floating" ? "fixed right-4 bottom-4 z-50" : undefined}
    >
      {/* Track, a fixed light gradient background (doesn't change with state), only the inner
          dot slides back and forth and changes color. */}
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
