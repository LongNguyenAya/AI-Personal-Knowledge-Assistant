import { systemSettings, adminAuditLog } from "@ai-assistant/db/src/schema";
import { withAdminContext } from "@/lib/with-admin-context";
import { SETTINGS_REGISTRY, type SettingKey } from "@ai-assistant/shared-types";

function isValidKey(key: string): key is SettingKey {
  return key in SETTINGS_REGISTRY;
}

export const PATCH = withAdminContext<{ key: string }>(async (req, { db, session, params }) => {
  if (!isValidKey(params.key)) return new Response("Setting không tồn tại", { status: 404 });

  const body = await req.json().catch(() => null);
  const value = body?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return new Response("Thiếu value hoặc sai kiểu dữ liệu", { status: 400 });
  }

  const meta = SETTINGS_REGISTRY[params.key];
  if (value < meta.min || value > meta.max) {
    return new Response(`value phải trong khoảng ${meta.min} - ${meta.max}`, { status: 400 });
  }

  // Upsert, vì chưa ai chỉnh setting này bao giờ thì chưa có dòng nào, lần đầu chỉnh mới tạo dòng.
  await db.transaction(async (tx) => {
    await tx
      .insert(systemSettings)
      .values({ key: params.key, value: String(value), updatedBy: session.user.id })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: String(value), updatedBy: session.user.id, updatedAt: new Date() },
      });

    await tx.insert(adminAuditLog).values({
      adminId: session.user.id,
      action: `system_setting.update:${params.key}`,
      targetUserId: null,
    });
  });

  return Response.json({ ok: true });
});
