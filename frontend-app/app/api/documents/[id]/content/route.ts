import { documents, chunks } from "@ai-assistant/db/src/schema";
import { and, asc, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

// Joins every chunk back in its original order into 1 block of text, heavier than GET /api/documents/[id] so it's only called once when the page opens.
export const GET = withAuthedContext<{ id: string }>(async (_req, { session, params, tx }) => {
  const [doc] = await tx
    .select({
      id: documents.id,
      fileName: documents.fileName,
      status: documents.status,
      createdAt: documents.createdAt,
      flaggedSuspicious: documents.flaggedSuspicious,
      flagReason: documents.flagReason,
    })
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, session.user.id)));

  if (!doc) return new Response("Not Found", { status: 404 });

  const rows = await tx
    .select({ content: chunks.content })
    .from(chunks)
    .where(eq(chunks.documentId, params.id))
    .orderBy(asc(chunks.chunkIndex));

  const content = rows.map((r) => r.content).join("\n\n");

  return Response.json({ ...doc, content });
});
