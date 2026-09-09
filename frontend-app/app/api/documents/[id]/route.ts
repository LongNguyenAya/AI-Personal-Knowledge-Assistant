import { documents } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";
import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Only returns the fields needed to poll 1 document's status, no need to fetch the whole list like GET /api/documents.
export const GET = withAuthedContext<{ id: string }>(async (_req, { session, params, tx }) => {
  const [doc] = await tx
    .select({ id: documents.id, fileName: documents.fileName, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, session.user.id)));

  if (!doc) return new Response("Not Found", { status: 404 });
  return Response.json(doc);
});

// A hard delete like reminders/[id]/route.ts, related chunks get removed automatically via FK cascade.
export const DELETE = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const [deleted] = await tx
    .delete(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, session.user.id)))
    .returning({ s3Key: documents.s3Key });

  if (!deleted) return new Response("Not Found", { status: 404 });

  // Cleaning up the physical file on backend-service is best-effort, doesn't block the response on failure since the DB has already cleared the user-facing part.
  const token = await mintBackendToken(session.user.id);
  await fetch(`${BACKEND_URL}/documents/file`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ key: deleted.s3Key }),
  }).catch(() => {});

  return Response.json({ success: true });
});
