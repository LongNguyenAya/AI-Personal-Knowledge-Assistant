"use client";
import { Suspense, useState } from "react";
import { Bot } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// better-auth redirects back here with ?token=... if the link is valid, or ?error=INVALID_TOKEN if the token is wrong/expired/already used.
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const invalidToken = searchParams.get("error") === "INVALID_TOKEN";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 8 = better-auth's default minPasswordLength, matching the validation on the register page.
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (!token) {
      setError("Missing token — please use the link from the email again.");
      return;
    }

    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Password reset failed");
      return;
    }
    setDone(true);
  }

  if (invalidToken || !token) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-soft dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Invalid link</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          The password reset link has expired or is invalid. Please request a new one.
        </p>
        <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Request new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-soft dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Password reset</h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Your password has been updated. Old sessions have been logged out, please log in again with your new password.
        </p>
        <Link href="/login" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-soft dark:border-gray-800 dark:bg-gray-900">
      <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-white">Reset password</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Enter a new password for your account.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="reset-password" className="text-xs font-medium text-gray-500 dark:text-gray-400">
            New password
          </label>
          <input
            id="reset-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            type="password"
            required
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-indigo-500/20"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="reset-confirm-password" className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Confirm new password
          </label>
          <input
            id="reset-confirm-password"
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
          {loading ? "Updating..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}

function ResetPasswordFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950" />;
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4 dark:bg-gray-950">
      <div className="text-center">
        <span className="flex items-center justify-center gap-2 text-lg font-bold text-indigo-600 dark:text-indigo-400">
          <Bot className="h-6 w-6" />
          AI Knowledge Assistant
        </span>
      </div>
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
