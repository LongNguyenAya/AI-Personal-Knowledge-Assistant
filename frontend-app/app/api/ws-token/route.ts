import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { mintBackendToken } from "@/lib/backend-token";

// Trình duyệt gọi endpoint này lấy token ngắn hạn trước khi tự mở WebSocket thẳng tới
// backend-service — cùng cơ chế ký JWT với mọi lời gọi backend-service khác.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.isActive === false) return new Response("Account locked", { status: 403 });
  if (session.user.deletedAt) return new Response("Account deleted", { status: 403 });

  const token = await mintBackendToken(session.user.id);
  return Response.json({ token });
}
