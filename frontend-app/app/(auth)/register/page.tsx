"use client";
import { useState } from "react";
import { Bot } from "lucide-react";
import { signUp } from "@/lib/auth-client";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 8 = minPasswordLength mặc định của better-auth (options.emailAndPassword.minPasswordLength,
    // không override ở lib/auth.ts) — validate luôn phía client cho phản hồi ngay, thay vì đợi API
    // trả về lỗi PASSWORD_TOO_SHORT sau 1 round-trip.
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    const { error } = await signUp.email({ email, password, name });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Đăng ký thất bại");
      return;
    }

    // requireEmailVerification=true -> signUp không tạo session ngay, phải xác nhận qua email
    // trước mới đăng nhập được (xem lib/auth.ts).
    setRegistered(true);
  }

  if (registered) {
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
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Nếu <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span> chưa từng đăng ký, chúng tôi
            vừa gửi 1 email xác nhận tới đó — bấm vào đường dẫn trong email để kích hoạt tài khoản.
          </p>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Nếu email này đã có tài khoản từ trước, hãy thử{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              đăng nhập
            </Link>{" "}
            — nếu tài khoản đó chưa xác nhận, hệ thống sẽ tự gửi lại email xác nhận cho bạn.
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
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Đăng ký</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Tạo tài khoản mới để bắt đầu.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="register-name" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Tên
            </label>
            <input
              id="register-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn A"
              type="text"
              required
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="register-email" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Email
            </label>
            <input
              id="register-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              required
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="register-password" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Mật khẩu
            </label>
            <input
              id="register-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              type="password"
              required
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="register-confirm-password" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Xác nhận mật khẩu
            </label>
            <input
              id="register-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
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
            {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
