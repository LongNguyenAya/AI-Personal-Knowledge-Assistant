import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Render blocks outbound SMTP connections to fight spam, so backend-service (on EC2, not blocked) sends the email instead, over HTTP.
export async function sendVerificationEmail(userId: string, to: string, url: string): Promise<void> {
  const token = await mintBackendToken(userId);
  const res = await fetch(`${BACKEND_URL}/auth/send-verification-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to, url }),
  });
  if (!res.ok) throw new Error("Failed to send verification email");
}
