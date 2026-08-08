import { documents, documentStatusEnum } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { withUserContext } from "../context";

type DocumentStatus = (typeof documentStatusEnum.enumValues)[number];

export async function updateStatus(userId: string, documentId: string, status: DocumentStatus) {
  return withUserContext(userId, (tx) =>
    tx.update(documents).set({ status }).where(eq(documents.id, documentId))
  );
}
