import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Cùng lý do với send-verification-email.ts, Render chặn SMTP ra ngoài nên nhờ backend-service (EC2) gửi hộ qua HTTP.
export async function sendResetPasswordEmail(userId: string, to: string, url: string): Promise<void> {
  const token = await mintBackendToken(userId);
  const res = await fetch(`${BACKEND_URL}/auth/send-reset-password-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, url }),
  });
  if (!res.ok) throw new Error("Gửi email đặt lại mật khẩu thất bại");
}
