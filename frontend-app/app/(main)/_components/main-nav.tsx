"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";
import { Bot, MessageSquare, FileText, CheckSquare, Bell, ShieldCheck, Menu, X, LogOut } from "lucide-react";

const LINKS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Tài liệu", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reminders", label: "Reminders", icon: Bell },
];

export default function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  // Sidebar cố định chỉ hợp lý ở màn hình đủ rộng (md+) — dưới đó nó chiếm gần hết chiều ngang,
  // nên mặc định ẩn trên mobile, hiện dạng overlay khi bấm "Menu" (đúng gợi ý "full-screen
  // overlay" cho mobile trong DESIGN.md).
  const [open, setOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden dark:border-gray-800 dark:bg-gray-900">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
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
          <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
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
