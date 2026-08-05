import { db } from "@/lib/db";
import { documents } from "@ai-assistant/db/src/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `uploads/${session.user.id}/documents/${Date.now()}-${file.name}`;

  // Lưu metadata trước, status = "uploaded"
  const [doc] = await db.insert(documents).values({
    userId: session.user.id,
    fileName: file.name,
    s3Key: key,
    status: "uploaded",
  }).returning();

  // Forward file thật + trigger xử lý sang backend-service
  const response = await fetch("http://localhost:4000/documents/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": session.user.id,
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
    await db.update(documents).set({ status: "failed" }).where(eq(documents.id, doc.id));
    return new Response("Upload processing failed", { status: 500 });
  }

  return Response.json(doc);
}