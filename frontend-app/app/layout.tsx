import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import ThemeToggle from "@/components/ThemeToggle";
import CommandPalette from "@/components/CommandPalette";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// The "vietnamese" subset is required since this font was chosen specifically for good Vietnamese diacritic support, missing that subset falls back to a default font.
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Personal Knowledge Assistant",
  description: "Multi-purpose AI assistant: document lookup, task/reminder creation, context-aware chat.",
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
        {/* Runs synchronously before React hydrates, sets the .dark class correctly from the very
            first frame, avoiding a theme flash (see THEME_INIT_SCRIPT in lib/theme.ts for the full explanation). */}
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
