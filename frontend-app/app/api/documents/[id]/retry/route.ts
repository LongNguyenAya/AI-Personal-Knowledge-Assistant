import { documents } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";
import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";

// Retrying a "failed" document doesn't re-upload the file, just re-sends it to the queue, since the failure always happens before insertChunks.
export const POST = withAuthedContext<{ id: string }>(async (_req, { session, params, tx }) => {
  const [doc] = await tx
    .select({ id: documents.id, s3Key: documents.s3Key, fileName: documents.fileName, status: documents.status })
    .from(documents)
    .where(and(eq(documents.id, params.id), eq(documents.userId, session.user.id)));

  if (!doc) return new Response("Not Found", { status: 404 });
  if (doc.status !== "failed") {
    return new Response("Can only retry a document that's in a failed state", { status: 400 });
  }

  await tx.update(documents).set({ status: "uploaded" }).where(eq(documents.id, doc.id));

  const token = await mintBackendToken(session.user.id);
  try {
    const res = await fetch(`${BACKEND_URL}/documents/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ documentId: doc.id, key: doc.s3Key, fileName: doc.fileName }),
    });
    if (!res.ok) throw new Error(`backend-service returned status ${res.status}`);
  } catch (err) {
    // Same reason as the main upload route, fetch can throw an error, not just return !res.ok, without a catch the document would get stuck at "uploaded" forever.
    console.error("[documents/retry] Failed to re-send to the queue:", err);
    await tx.update(documents).set({ status: "failed" }).where(eq(documents.id, doc.id));
    return new Response("Failed to re-send to the processing queue", { status: 500 });
  }

  return Response.json({ success: true });
});
