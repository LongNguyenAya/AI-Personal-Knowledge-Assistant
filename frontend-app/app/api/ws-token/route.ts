import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { mintBackendToken } from "@/lib/backend-token";

// The browser calls this endpoint to get a short-lived token before opening a WebSocket directly to backend-service, the same JWT signing scheme as every other call.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.isActive === false) return new Response("Account locked", { status: 403 });
  if (session.user.deletedAt) return new Response("Account deleted", { status: 403 });

  const token = await mintBackendToken(session.user.id);
  return Response.json({ token });
}
