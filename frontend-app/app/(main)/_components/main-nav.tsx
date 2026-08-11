"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "@/lib/auth-client";

const LINKS = [
  { href: "/chat", label: "Chat" },
  { href: "/documents", label: "Tài liệu" },
  { href: "/tasks", label: "Tasks" },
  { href: "/reminders", label: "Reminders" },
];

export default function MainNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-6">
        <span className="text-sm font-bold text-gray-900 dark:text-white">AI Knowledge Assistant</span>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {session?.user.role === "admin" && (
            <Link
              href="/admin/dashboard"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Admin
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {session?.user.email && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{session.user.email}</span>
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
