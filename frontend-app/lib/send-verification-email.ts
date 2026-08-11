import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Render (nơi frontend-app chạy) chặn kết nối SMTP ra ngoài để chống spam — nên nhờ backend-service
// (chạy trên EC2, không bị chặn) gửi email hộ qua HTTP thay vì tự gửi SMTP trực tiếp ở đây.
export async function sendVerificationEmail(userId: string, to: string, url: string): Promise<void> {
  const token = await mintBackendToken(userId);
  const res = await fetch(`${BACKEND_URL}/auth/send-verification-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, url }),
  });
  if (!res.ok) throw new Error("Gửi email xác nhận thất bại");
}
