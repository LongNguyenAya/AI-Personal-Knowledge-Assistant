import { knowledgeFiles, adminAuditLog } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Vòng đời hợp lệ: pending -> approved | rejected; approved -> revoked. rejected/revoked là
// điểm dừng (muốn ghi lại thì proposeKnowledgeNote note mới) — map ở đây vừa là whitelist quyết
// định vừa là điều kiện WHERE cho UPDATE bên dưới.
const REQUIRED_PRIOR_STATUS = { approved: "pending", rejected: "pending", revoked: "approved" } as const;

export const POST = withAdminContext<{ id: string }>(async (req, { db, session, params }) => {
  if (!UUID_RE.test(params.id)) return new Response("Invalid id", { status: 400 });

  const { decision } = await req.json();
  if (!(decision in REQUIRED_PRIOR_STATUS)) return new Response("Invalid decision", { status: 400 });

  const requiredPriorStatus = REQUIRED_PRIOR_STATUS[decision as keyof typeof REQUIRED_PRIOR_STATUS];

  // UPDATE ... WHERE id=... AND status=<trạng thái trước hợp lệ> — không có row nào trả về nghĩa
  // là đã bị admin khác xử lý trước (hoặc note không tồn tại), tránh race khi 2 tab admin duyệt
  // cùng lúc đè trạng thái lên nhau.
  const notFoundOrConflict = await db.transaction(async (tx) => {
    const updated = await tx
      .update(knowledgeFiles)
      .set({ status: decision, reviewedBy: session.user.id, reviewedAt: new Date() })
      .where(and(eq(knowledgeFiles.id, params.id), eq(knowledgeFiles.status, requiredPriorStatus)))
      .returning({ id: knowledgeFiles.id });

    if (updated.length === 0) return true;

    await tx.insert(adminAuditLog).values({
      adminId: session.user.id,
      action: `knowledge_file.${decision}:${params.id}`,
      targetUserId: null,
    });
    return false;
  });

  if (notFoundOrConflict) return new Response("Conflict", { status: 409 });
  return Response.json({ ok: true });
});
