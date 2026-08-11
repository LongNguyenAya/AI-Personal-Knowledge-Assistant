import { documents } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";
import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Hard delete, giống reminders/[id]/route.ts — chunks liên quan tự xoá theo nhờ FK cascade,
// không cần tự xoá riêng.
export const DELETE = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const [deleted] = await tx
    .delete(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, session.user.id)))
    .returning({ s3Key: documents.s3Key });

  if (!deleted) return new Response("Not Found", { status: 404 });

  // Dọn file vật lý trên backend-service — best-effort, không chặn response nếu lỗi (đã xoá
  // xong dòng document + chunks trong DB, đó mới là phần ảnh hưởng trực tiếp tới người dùng).
  const token = await mintBackendToken(session.user.id);
  await fetch(`${BACKEND_URL}/documents/file`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ key: deleted.s3Key }),
  }).catch(() => {});

  return Response.json({ success: true });
});
