import { documents } from "@ai-assistant/db/src/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { withUserContext } from "@/lib/db-context";
import { withAuthedContext } from "@/lib/with-authed-context";
import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";
import { getSettingValue } from "@/lib/settings";

export const GET = withAuthedContext(async (req, { session, tx }) => {
  const list = await tx
    .select({
      id: documents.id,
      fileName: documents.fileName,
      status: documents.status,
      createdAt: documents.createdAt,
      flaggedSuspicious: documents.flaggedSuspicious,
      flagReason: documents.flagReason,
    })
    .from(documents)
    .where(eq(documents.userId, session.user.id))
    .orderBy(desc(documents.createdAt));

  return Response.json(list);
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.isActive === false) return new Response("Account locked", { status: 403 });
  if (session.user.deletedAt) return new Response("Account deleted", { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return new Response("Thiếu file hoặc file rỗng", { status: 400 });
  }

  // Admin tự chỉnh qua /admin/settings, khớp "maxUploadMb" phía backend-service.
  const maxUploadMb = await getSettingValue("maxUploadMb");
  if (file.size > maxUploadMb * 1024 * 1024) {
    return new Response(`File quá lớn — tối đa ${maxUploadMb}MB`, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `uploads/${session.user.id}/documents/${Date.now()}-${file.name}`;

  // Insert trong 1 transaction ngắn, không dùng withAuthedContext vì nó sẽ giữ transaction mở suốt cuộc gọi fetch embedding.
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
  try {
    const response = await fetch(`${BACKEND_URL}/documents/upload`, {
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
    if (!response.ok) throw new Error(`backend-service trả về status ${response.status}`);
  } catch (err) {
    // fetch() có thể ném lỗi (mất kết nối/timeout) chứ không chỉ trả !response.ok, không bắt thì document kẹt vĩnh viễn ở "uploaded".
    console.error("[documents/upload] Forward sang backend-service thất bại:", err);
    await withUserContext(session.user.id, (tx) =>
      tx.update(documents).set({ status: "failed" }).where(eq(documents.id, doc.id))
    );
    return new Response("Upload processing failed", { status: 500 });
  }

  return Response.json(doc);
}
