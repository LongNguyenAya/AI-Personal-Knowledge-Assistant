import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { dbAdmin } from "./db-admin";
import type { Session } from "@/types/auth";

// Parallel to with-authed-context.ts but not shared with it, since middleware.ts doesn't block "/api/admin/*" so permission has to be checked here.
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
