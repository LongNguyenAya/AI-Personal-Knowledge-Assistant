"use client";
import Link from "next/link";
import { Bot } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

export default function AdminHeader() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3 sm:gap-6">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          AI Knowledge Assistant
        </span>
        <Link
          href="/chat"
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Về ứng dụng
        </Link>
      </div>

      <div className="flex items-center gap-3">
        {session?.user.email && (
          <span className="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">{session.user.email}</span>
        )}
        <button
          onClick={handleSignOut}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
