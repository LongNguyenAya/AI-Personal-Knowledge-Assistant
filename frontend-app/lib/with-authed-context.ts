import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { withUserContext, type UserScopedTx } from "./db-context";

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export function withAuthedContext<P = Record<string, never>>(
  handler: (req: Request, ctx: { session: Session; params: P; tx: UserScopedTx }) => Promise<Response>
) {
  return async (req: Request, routeCtx: { params: Promise<P> }): Promise<Response> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return new Response("Unauthorized", { status: 401 });
    if (session.user.isActive === false) return new Response("Account locked", { status: 403 });
    if (session.user.deletedAt) return new Response("Account deleted", { status: 403 });

    const params = await routeCtx.params;
    return withUserContext(session.user.id, (tx) => handler(req, { session, params, tx }));
  };
}
