"use client";
import { Suspense, useState } from "react";
import { Bot } from "lucide-react";
import { signIn } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// better-auth returns fixed error codes verbatim in English, translated here to match the UI, other errors are left as-is.
const KNOWN_ERROR_MESSAGES: Record<string, string> = {
  "Email not verified": "Account email not verified — we just sent a new verification email, please check your inbox.",
  "Invalid email or password": "Wrong email or password.",
};

// ?error=... shows up when the user clicks an expired/invalid email verification link, better-auth redirects here with this query itself.
const VERIFY_ERROR_MESSAGE = "The verification link is invalid or has expired. Please log in again to receive a new verification email.";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  // A lazy initializer instead of useEffect+setState, since ?error= only needs reading once at mount, avoiding a cascading render.
  const [error, setError] = useState<string | null>(() => (searchParams.get("error") ? VERIFY_ERROR_MESSAGE : null));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(KNOWN_ERROR_MESSAGES[error.message ?? ""] ?? error.message ?? "Login failed");
      return;
    }

    if (data.user.role === "admin") {
      router.push("/admin/dashboard");
    } else {
      router.push("/chat");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 dark:bg-gray-950">
      <div className="text-center">
        <span className="flex items-center justify-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
          <Bot className="h-6 w-6" />
          AI Knowledge Assistant
        </span>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your personal knowledge assistant</p>
      </div>

      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-soft dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Log in</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Log in to access your documents, tasks, and reminders.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Email
            </label>
            <input
              id="login-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              type="email"
              required
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
            Sign up
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
