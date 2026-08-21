"use client";
import { useState } from "react";
import { Bot } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Cố tình không hiện khác biệt giữa "email tồn tại" và "không tồn tại" — better-auth cũng trả
    // cùng 1 thông báo cho cả 2 trường hợp (tránh lộ email nào đã đăng ký).
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Gửi email đặt lại mật khẩu thất bại");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 dark:bg-gray-950">
        <div className="text-center">
          <span className="flex items-center justify-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
            <Bot className="h-6 w-6" />
            AI Knowledge Assistant
          </span>
        </div>
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-soft dark:border-gray-800 dark:bg-gray-900">
          <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Kiểm tra email của bạn</h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Nếu <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span> có tài khoản trong hệ thống,
            chúng tôi vừa gửi 1 đường dẫn đặt lại mật khẩu tới đó — đường dẫn có hiệu lực trong 1 tiếng.
          </p>
          <Link href="/login" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 dark:bg-gray-950">
      <div className="text-center">
        <span className="flex items-center justify-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
          <Bot className="h-6 w-6" />
          AI Knowledge Assistant
        </span>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Trợ lý tri thức cá nhân của bạn</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-soft dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Quên mật khẩu</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Nhập email đã đăng ký, chúng tôi sẽ gửi đường dẫn để bạn đặt lại mật khẩu.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="forgot-email" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Email
            </label>
            <input
              id="forgot-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              required
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Đang gửi..." : "Gửi đường dẫn đặt lại"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Nhớ ra mật khẩu rồi?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
