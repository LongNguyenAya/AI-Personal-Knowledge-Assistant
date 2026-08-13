import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { dbAdmin } from "./db-admin";
import type { Session } from "@/types/auth";

// Song song với with-authed-context.ts nhưng không dùng chung — route admin cần dbAdmin (bypass
// RLS) thay vì tx theo 1 user, và cần check role="admin" chứ không chỉ check đã đăng nhập.
// middleware.ts chỉ chặn "/admin/*", không chặn "/api/admin/*" (khác prefix), nên route admin
// phải tự check quyền ở đây, không dựa vào middleware.
export function withAdminContext<P = Record<string, never>>(
  handler: (req: Request, ctx: { session: Session; params: P; db: typeof dbAdmin }) => Promise<Response>
) {
  return async (req: Request, routeCtx: { params: Promise<P> }): Promise<Response> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new Response("Unauthorized", { status: 401 });
    if (session.user.role !== "admin") return new Response("Forbidden", { status: 403 });
    if (session.user.isActive === false) return new Response("Account locked", { status: 403 });
    if (session.user.deletedAt) return new Response("Account deleted", { status: 403 });

    const params = await routeCtx.params;
    return handler(req, { session, params, db: dbAdmin });
  };
}
