import { users, adminAuditLog } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

export const PATCH = withAdminContext<{ id: string }>(async (req, { db, session, params }) => {
  const body = await req.json();

  // Fully blocks an admin from locking/deleting their own logged-in account, avoiding a lockout nobody can undo.
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
      // If params.id doesn't exist the update changes no rows but the audit log still throws an FK error, checked early to return a clean 404.
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

  // softDelete=true is a soft delete that blocks login right at auth.ts, softDelete=false restores it, unlike isActive which only blocks API calls.
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
