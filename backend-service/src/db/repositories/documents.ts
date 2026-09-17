import { documents, type DocumentStatus } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withUserContext } from "../context";

// Cheap existence check (LIMIT 1, not a count), only called when searchDocuments comes back empty.
// Tells apart "no documents processed yet" from "processed, just nothing relevant to this query".
export async function hasAnyProcessedDocuments(userId: string): Promise<boolean> {
  const [row] = await withUserContext(userId, (tx) =>
    tx.select({ id: documents.id }).from(documents).where(and(eq(documents.userId, userId), eq(documents.status, "processed"))).limit(1)
  );
  return !!row;
}

// Filters userId explicitly even though RLS already does, the same 2-layer defense pattern as the other repos.
export async function updateStatus(userId: string, documentId: string, status: DocumentStatus) {
  return withUserContext(userId, (tx) =>
    tx.update(documents).set({ status }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
  );
}

// Records the injection scan result, doesn't block processing, just flags it to warn the UI and lower confidence.
export async function flagSuspicious(userId: string, documentId: string, reason: string) {
  return withUserContext(userId, (tx) =>
    tx.update(documents).set({ flaggedSuspicious: true, flagReason: reason }).where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
  );
}

// Puts the list of document names into the system prompt so the model can match a name the user mentions to the right id.
export async function listDocuments(userId: string) {
  return withUserContext(userId, (tx) =>
    tx.select({ id: documents.id, fileName: documents.fileName }).from(documents).where(eq(documents.userId, userId))
  );
}
