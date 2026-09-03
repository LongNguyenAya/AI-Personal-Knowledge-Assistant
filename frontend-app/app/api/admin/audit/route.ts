import { adminAuditLog, users } from "@ai-assistant/db/src/schema";
import { alias } from "drizzle-orm/pg-core";
import { and, count, desc, eq, like } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// 4 nhóm action thật đang tồn tại, dùng làm tab lọc ở /admin/audit, khớp đúng tiền tố trước dấu "." trong cột action.
const VALID_CATEGORIES = ["user", "agent_prompt", "system_setting", "knowledge_file"] as const;

// admin_audit_log không RLS, chỉ đọc qua dbAdmin, adminId/targetUserId cùng trỏ về users nên phải alias 2 lần mới join được.
export const GET = withAdminContext(async (req, { db }) => {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const category = url.searchParams.get("category");

  const adminUser = alias(users, "admin_user");
  const targetUser = alias(users, "target_user");

  const where =
    category && (VALID_CATEGORIES as readonly string[]).includes(category)
      ? like(adminAuditLog.action, `${category}.%`)
      : undefined;

  const [logs, [{ total }]] = await Promise.all([
    db
      .select({
        id: adminAuditLog.id,
        action: adminAuditLog.action,
        createdAt: adminAuditLog.createdAt,
        adminName: adminUser.name,
        adminEmail: adminUser.email,
        targetName: targetUser.name,
        targetEmail: targetUser.email,
      })
      .from(adminAuditLog)
      .leftJoin(adminUser, eq(adminAuditLog.adminId, adminUser.id))
      .leftJoin(targetUser, eq(adminAuditLog.targetUserId, targetUser.id))
      .where(where)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(adminAuditLog).where(where),
  ]);

  return Response.json({ logs, total, page, pageSize });
});
