"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useSession } from "@/lib/auth-client";
import {
  MessageSquare,
  FileText,
  CheckSquare,
  Bell,
  Sparkles,
  NotebookPen,
  UserRound,
  LayoutDashboard,
  Users,
  BookOpen,
  SlidersHorizontal,
} from "lucide-react";

const MAIN_LINKS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/documents", label: "Tài liệu", icon: FileText },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/digest", label: "Tóm tắt tuần", icon: Sparkles },
  { href: "/corrections", label: "Ghi chú AI", icon: NotebookPen },
  { href: "/settings", label: "Hồ sơ cá nhân", icon: UserRound },
];

const ADMIN_LINKS = [
  { href: "/admin/dashboard", label: "Admin — Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Admin — Users", icon: Users },
  { href: "/admin/prompts", label: "Admin — Prompts", icon: Sparkles },
  { href: "/admin/knowledge", label: "Admin — Knowledge base", icon: BookOpen },
  { href: "/admin/settings", label: "Admin — Settings", icon: SlidersHorizontal },
];

// Cmd/Ctrl+K gộp trang chính và trang admin thành 1 bảng gõ-để-lọc, chỉ điều hướng, chưa làm hành động nhanh.
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const links = session?.user.role === "admin" ? [...MAIN_LINKS, ...ADMIN_LINKS] : MAIN_LINKS;

  return (
    <>
      {/* cmdk style qua data-attribute ([cmdk-overlay]), không phải className — Command.Dialog
          luôn render overlay nhưng không tự có nền tối, phải tự thêm CSS này. */}
      <style>{`[cmdk-overlay]{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:99;}`}</style>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Điều hướng nhanh"
        className="fixed top-[15vh] left-1/2 z-[100] w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900"
      >
        <Command.Input
          autoFocus
          placeholder="Đi tới trang... (Esc để đóng)"
          className="w-full border-b border-gray-100 px-4 py-3 text-sm text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            Không tìm thấy trang nào.
          </Command.Empty>
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Command.Item
                key={link.href}
                value={link.label}
                onSelect={() => go(link.href)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 aria-selected:bg-indigo-50 aria-selected:text-indigo-600 dark:text-gray-300 dark:aria-selected:bg-indigo-500/10 dark:aria-selected:text-indigo-300"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
