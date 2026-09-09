import { knowledgeFiles } from "@ai-assistant/db/src/schema";
import { eq, sql } from "drizzle-orm";
import { dbAdmin } from "../admin-client";
import { embedText } from "../../utils/embedding";
import type { InsertPendingNoteInput, RelevantKnowledgeNote } from "../../types/knowledge";

const KNOWLEDGE_TOP_K = 8;

// A shared table with no RLS, no hardcoded distance threshold filter so the action agent judges relevance itself.
export async function findRelevantApprovedNotes(queryEmbedding: number[]): Promise<RelevantKnowledgeNote[]> {
  const embeddingLiteral = JSON.stringify(queryEmbedding);
  return dbAdmin
    .select({ id: knowledgeFiles.id, path: knowledgeFiles.path, title: knowledgeFiles.title, content: knowledgeFiles.content })
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.status, "approved"))
    .orderBy(sql`${knowledgeFiles.embedding} <=> ${embeddingLiteral}::vector`)
    .limit(KNOWLEDGE_TOP_K);
}

// Computes the embedding right at creation instead of waiting for approval, since the content doesn't change between those 2 points.
export async function insertPendingNote(data: InsertPendingNoteInput) {
  const embedding = await embedText(`${data.title}\n${data.content}`);
  const [created] = await dbAdmin
    .insert(knowledgeFiles)
    .values({ ...data, status: "pending", embedding })
    .returning();
  return created;
}
