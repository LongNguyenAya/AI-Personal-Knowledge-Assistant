import { documents, type DocumentStatus } from "@ai-assistant/db/src/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { withUserContext } from "../context";
import { dbAdmin } from "../admin-client";

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

// Scans all users at once, same reason dbAdmin is used in reminders.ts. A document only stays
// "uploaded" this long if its SQS ingestion message was lost or the worker crashed mid-processing
// before ever reaching "processing"/"failed", document-recovery-scheduler.ts re-enqueues these.
export async function findStuckUploadedDocuments(olderThan: Date, maxRetries: number) {
  return dbAdmin
    .select({ id: documents.id, userId: documents.userId, s3Key: documents.s3Key, fileName: documents.fileName })
    .from(documents)
    .where(and(eq(documents.status, "uploaded"), lt(documents.updatedAt, olderThan), lt(documents.ingestionRetryCount, maxRetries)));
}

// Bumps updatedAt too, otherwise the same document would be picked up again on the very next scan
// before the re-enqueued message even had a chance to be processed.
export async function markIngestionRetried(documentId: string) {
  return dbAdmin
    .update(documents)
    .set({ ingestionRetryCount: sql`${documents.ingestionRetryCount} + 1`, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}

// Still stuck at "uploaded" after using up all automatic retries, gives up and surfaces "failed" so
// the user sees a clear state and can use the existing manual Retry button instead of it looking stuck forever.
export async function findExhaustedUploadedDocuments(olderThan: Date, maxRetries: number) {
  return dbAdmin
    .select({ id: documents.id, userId: documents.userId })
    .from(documents)
    .where(and(eq(documents.status, "uploaded"), lt(documents.updatedAt, olderThan), sql`${documents.ingestionRetryCount} >= ${maxRetries}`));
}

export async function markIngestionGivenUp(documentId: string) {
  return dbAdmin.update(documents).set({ status: "failed" }).where(eq(documents.id, documentId));
}
