"use client";
import { Suspense, useState } from "react";
import { signIn } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// better-auth trả nguyên văn tiếng Anh cho các mã lỗi cố định — dịch lại cho khớp phần còn lại
// của UI, giữ nguyên (hiển thị thẳng) các lỗi khác không nằm trong danh sách này.
const KNOWN_ERROR_MESSAGES: Record<string, string> = {
  "Email not verified": "Tài khoản chưa xác nhận email — chúng tôi vừa gửi lại 1 email xác nhận mới, vui lòng kiểm tra hộp thư.",
  "Invalid email or password": "Sai email hoặc mật khẩu.",
};

// ?error=... xuất hiện khi user bấm link xác nhận email đã hết hạn/không hợp lệ (better-auth tự
// redirect về callbackURL kèm query này, xem app/page.tsx) — trước đây bị bỏ qua âm thầm.
const VERIFY_ERROR_MESSAGE = "Đường dẫn xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại để nhận email xác nhận mới.";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  // Lazy initializer thay vì useEffect+setState — ?error= chỉ cần đọc 1 lần lúc mount, không
  // phải state đồng bộ hoá liên tục với searchParams (tránh cascading render, cũng tránh lỗi
  // react-hooks/set-state-in-effect của React Compiler).
  const [error, setError] = useState<string | null>(() => (searchParams.get("error") ? VERIFY_ERROR_MESSAGE : null));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(KNOWN_ERROR_MESSAGES[error.message ?? ""] ?? error.message ?? "Đăng nhập thất bại");
      return;
    }

    // Điều hướng theo role
    if (data.user.role === "admin") {
      router.push("/admin/dashboard");
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Đăng nhập</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">AI Personal Knowledge Assistant</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            required
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu"
            type="password"
            required
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
          />

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Đăng ký
          </Link>
        </p>
      </div>
    </div>
  );
}

function LoginFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950" />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
