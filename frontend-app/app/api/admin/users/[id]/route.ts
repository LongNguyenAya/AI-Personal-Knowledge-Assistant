import { users, adminAuditLog } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

export const PATCH = withAdminContext<{ id: string }>(async (req, { db, session, params }) => {
  const body = await req.json();

  // Admin tự khoá/xoá chính tài khoản đang đăng nhập có thể khiến không còn ai mở lại được — chặn hẳn tình huống này.
  if (params.id === session.user.id) {
    return new Response("Không thể tự thao tác lên chính tài khoản admin đang đăng nhập", { status: 400 });
  }

  if (typeof body.isActive === "boolean") {
    const notFound = await db.transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({ isActive: body.isActive, updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning({ id: users.id });
      // params.id không tồn tại thì update không đổi dòng nào, nhưng audit log bên dưới vẫn
      // chạy và ném lỗi FK — kiểm tra sớm để trả 404 sạch thay vì rơi xuống 500 chung.
      if (updated.length === 0) return true;
      await tx.insert(adminAuditLog).values({
        adminId: session.user.id,
        action: body.isActive ? "user.unlock" : "user.lock",
        targetUserId: params.id,
      });
      return false;
    });
    if (notFound) return new Response("Not Found", { status: 404 });
    return Response.json({ ok: true });
  }

  // softDelete=true là xoá mềm, chặn đăng nhập ngay từ hooks.before trong auth.ts. softDelete=false
  // là khôi phục — chỉ admin chủ động làm mới dùng lại được tài khoản, khác isActive (khoá vẫn
  // đăng nhập được, chỉ chặn gọi API).
  if (typeof body.softDelete === "boolean") {
    const notFound = await db.transaction(async (tx) => {
      const updated = await tx
        .update(users)
        .set({ deletedAt: body.softDelete ? new Date() : null, updatedAt: new Date() })
        .where(eq(users.id, params.id))
        .returning({ id: users.id });
      if (updated.length === 0) return true;
      await tx.insert(adminAuditLog).values({
        adminId: session.user.id,
        action: body.softDelete ? "user.soft_delete" : "user.restore",
        targetUserId: params.id,
      });
      return false;
    });
    if (notFound) return new Response("Not Found", { status: 404 });
    return Response.json({ ok: true });
  }

  return new Response("Bad Request", { status: 400 });
});
