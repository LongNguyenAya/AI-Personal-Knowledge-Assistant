import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1];
  const question = lastMessage.parts?.find((p: any) => p.type === "text")?.text ?? "";

  const response = await fetch("http://localhost:4000/agent/action", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": session.user.id },
    body: JSON.stringify({ message: question }),
  });

  // Forward nguyên response, giữ đúng header content-type mà toUIMessageStreamResponse() đã set
  return new Response(response.body, {
    headers: response.headers,
  });
}