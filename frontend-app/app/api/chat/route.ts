import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.isActive === false) return new Response("Account locked", { status: 403 });
  if (session.user.deletedAt) return new Response("Account deleted", { status: 403 });

  const { messages, conversationId, attachedDocumentId } = await req.json();
  const lastMessage = messages[messages.length - 1];
  const question =
    lastMessage.parts?.find((p: { type: string }) => p.type === "text")?.text ?? "";

  const token = await mintBackendToken(session.user.id);
  const response = await fetch(`${BACKEND_URL}/agent/orchestrate/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ message: question, conversationId, attachedDocumentId }),
  });

  // Forwarding the response straight through on a backend error would make the client receive a malformed stream, response.ok has to be checked first.
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return new Response(text || "Backend service lỗi", { status: response.status });
  }

  // Forwards the response as-is, keeping the exact content-type header that toUIMessageStreamResponse() already set
  return new Response(response.body, {
    headers: response.headers,
  });
}
