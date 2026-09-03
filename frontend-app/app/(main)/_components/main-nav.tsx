"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Bot, MessageSquare, FileText, CheckSquare, Bell, Sparkles, NotebookPen, UserRound, ShieldCheck, Menu, X, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

// Logo dạng ô vuông gradient thay icon Bot trơn trước đây, dùng chung cho cả top-bar mobile lẫn header sidebar desktop.
function Logo() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-600 to-amber-500">
      <Bot className="h-[18px] w-[18px] text-white" />
    </span>
  );
}

const LINKS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Tài liệu", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/digest", label: "Tóm tắt tuần", icon: Sparkles },
  { href: "/corrections", label: "Ghi chú AI", icon: NotebookPen },
  { href: "/settings", label: "Hồ sơ cá nhân", icon: UserRound },
];

export default function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  // Sidebar cố định chỉ hợp lý ở màn hình đủ rộng (md+), mặc định ẩn trên mobile và hiện dạng overlay khi bấm "Menu".
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden dark:border-gray-800 dark:bg-gray-900">
        <span className="flex items-center gap-2.5 text-sm font-bold text-gray-900 dark:text-white">
          <Logo />
          AI Knowledge Assistant
        </span>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`${
          open ? "flex" : "hidden"
        } fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 md:static md:z-auto md:flex md:w-60 md:shrink-0`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <span className="flex items-center gap-2.5 text-sm font-bold text-gray-900 dark:text-white">
            <Logo />
            AI Knowledge Assistant
          </span>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg border-l-4 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
          {session?.user.role === "admin" && (
            <Link
              href="/admin/dashboard"
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-lg border-l-4 px-3 py-2 text-sm font-medium transition-colors ${
                pathname?.startsWith("/admin")
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Admin
            </Link>
          )}
        </nav>

        <div className="border-t border-gray-100 p-3 dark:border-gray-800">
          {session?.user.email && (
            <p className="truncate px-3 pb-2 text-xs text-gray-500 dark:text-gray-400">{session.user.email}</p>
          )}
          <div className="mb-1 flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-[13px] text-gray-500 dark:text-gray-400">Giao diện</span>
            <ThemeToggle variant="inline" />
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
}
