import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Same reason as send-verification-email.ts, Render blocks outbound SMTP so backend-service (on EC2) sends it instead, over HTTP.
export async function sendResetPasswordEmail(userId: string, to: string, url: string): Promise<void> {
  const token = await mintBackendToken(userId);
  const res = await fetch(`${BACKEND_URL}/auth/send-reset-password-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, url }),
  });
  if (!res.ok) throw new Error("Failed to send password reset email");
}
