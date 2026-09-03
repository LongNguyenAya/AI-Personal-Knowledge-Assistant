"use client";
import { useState } from "react";
import { Bot, Menu, X } from "lucide-react";
import AdminNav from "./admin-nav";
import ThemeToggle from "@/components/ThemeToggle";

// Cùng pattern responsive với MainNav, sidebar cố định chỉ hợp lý ở md+, dưới đó ẩn mặc định và hiện dạng overlay.
export default function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="border-b border-gray-200 bg-white px-4 py-2 md:hidden dark:border-gray-800 dark:bg-gray-900">
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
        } fixed inset-y-0 left-0 z-50 w-64 flex-col overflow-y-auto border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:static md:z-auto md:flex md:w-60 md:shrink-0`}
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              <Bot className="h-3.5 w-3.5" />
              AI Knowledge Assistant
            </p>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div onClick={() => setOpen(false)}>
          <AdminNav />
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 px-3 pt-4 dark:border-gray-800">
          <span className="text-[13px] text-gray-500 dark:text-gray-400">Giao diện</span>
          <ThemeToggle variant="inline" />
        </div>
      </aside>
    </>
  );
}
