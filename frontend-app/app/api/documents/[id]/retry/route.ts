import { documents } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";
import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Thử lại tài liệu "failed" không upload lại file, chỉ gửi lại vào hàng đợi, vì lỗi luôn xảy ra trước insertChunks.
export const POST = withAuthedContext<{ id: string }>(async (_req, { session, params, tx }) => {
  const [doc] = await tx
    .select({ id: documents.id, s3Key: documents.s3Key, fileName: documents.fileName, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, session.user.id)));

  if (!doc) return new Response("Not Found", { status: 404 });
  if (doc.status !== "failed") {
    return new Response("Chỉ thử lại được tài liệu đang ở trạng thái lỗi", { status: 400 });
  }

  await tx.update(documents).set({ status: "uploaded" }).where(eq(documents.id, doc.id));

  const token = await mintBackendToken(session.user.id);
  try {
    const res = await fetch(`${BACKEND_URL}/documents/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ documentId: doc.id, key: doc.s3Key, fileName: doc.fileName }),
    });
    if (!res.ok) throw new Error(`backend-service trả về status ${res.status}`);
  } catch (err) {
    // Cùng lý do với route upload chính, fetch có thể ném lỗi chứ không chỉ !res.ok, không bắt thì document kẹt ở "uploaded" mãi.
    console.error("[documents/retry] Gửi lại vào hàng đợi thất bại:", err);
    await tx.update(documents).set({ status: "failed" }).where(eq(documents.id, doc.id));
    return new Response("Gửi lại vào hàng đợi xử lý thất bại", { status: 500 });
  }

  return Response.json({ success: true });
});
