import { documents } from "@ai-assistant/db/src/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { withUserContext } from "@/lib/db-context";
import { withAuthedContext } from "@/lib/with-authed-context";
import { mintBackendToken } from "@/lib/backend-token";
import { BACKEND_URL } from "@/lib/config";
import { getSettingValue } from "@/lib/settings";

export const GET = withAuthedContext(async (req, { session, tx }) => {
  const list = await tx
    .select({
      id: documents.id,
      fileName: documents.fileName,
      status: documents.status,
      createdAt: documents.createdAt,
      flaggedSuspicious: documents.flaggedSuspicious,
      flagReason: documents.flagReason,
    })
    .from(documents)
    .where(eq(documents.userId, session.user.id))
    .orderBy(desc(documents.createdAt));

  return Response.json(list);
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.isActive === false) return new Response("Account locked", { status: 403 });
  if (session.user.deletedAt) return new Response("Account deleted", { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return new Response("Missing file or empty file", { status: 400 });
  }

  // Admin adjusts this via /admin/settings, matching "maxUploadMb" on the backend-service side.
  const maxUploadMb = await getSettingValue("maxUploadMb");
  if (file.size > maxUploadMb * 1024 * 1024) {
    return new Response(`File too large — max ${maxUploadMb}MB`, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `uploads/${session.user.id}/documents/${Date.now()}-${file.name}`;

  // Inserted in 1 short transaction, doesn't use withAuthedContext since that would keep the transaction open through the whole embedding fetch call.
  const [doc] = await withUserContext(session.user.id, (tx) =>
    tx.insert(documents).values({
      userId: session.user.id,
      fileName: file.name,
      s3Key: key,
      status: "uploaded",
    }).returning()
  );

  // Forwards the actual file plus triggers processing over to backend-service
  const token = await mintBackendToken(session.user.id);
  try {
    const response = await fetch(`${BACKEND_URL}/documents/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        documentId: doc.id, // included so backend-service knows exactly which row to update
        key,
        fileName: file.name,
        base64: buffer.toString("base64"),
      }),
    });
    if (!response.ok) throw new Error(`backend-service returned status ${response.status}`);
  } catch (err) {
    // fetch() can throw an error (lost connection/timeout), not just return !response.ok, without a catch the document would get stuck at "uploaded" forever.
    console.error("[documents/upload] Forward to backend-service failed:", err);
    await withUserContext(session.user.id, (tx) =>
      tx.update(documents).set({ status: "failed" }).where(eq(documents.id, doc.id))
    );
    return new Response("Upload processing failed", { status: 500 });
  }

  return Response.json(doc);
}
