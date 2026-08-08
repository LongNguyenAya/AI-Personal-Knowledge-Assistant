import { documents } from "@ai-assistant/db/src/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { withUserContext } from "@/lib/db-context";
import { mintBackendToken } from "@/lib/backend-token";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `uploads/${session.user.id}/documents/${Date.now()}-${file.name}`;

  // Insert trong 1 transaction ngắn có RLS context — không dùng withAuthedContext ở đây vì
  // nó sẽ giữ transaction mở xuyên suốt cuộc gọi fetch bên dưới (embedding có thể mất vài giây).
  const [doc] = await withUserContext(session.user.id, (tx) =>
    tx.insert(documents).values({
      userId: session.user.id,
      fileName: file.name,
      s3Key: key,
      status: "uploaded",
    }).returning()
  );

  // Forward file thật + trigger xử lý sang backend-service
  const token = await mintBackendToken(session.user.id);
  const response = await fetch("http://localhost:4000/documents/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({
      documentId: doc.id, // gửi kèm ID để backend-service biết update đúng dòng nào
      key,
      fileName: file.name,
      base64: buffer.toString("base64"),
    }),
  });

  if (!response.ok) {
    // Nếu forward thất bại, đánh dấu document là failed
    await withUserContext(session.user.id, (tx) =>
      tx.update(documents).set({ status: "failed" }).where(eq(documents.id, doc.id))
    );
    return new Response("Upload processing failed", { status: 500 });
  }

  return Response.json(doc);
}
