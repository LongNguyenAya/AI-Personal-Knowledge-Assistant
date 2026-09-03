import { knowledgeFiles } from "@ai-assistant/db/src/schema";
import { eq, sql } from "drizzle-orm";
import { dbAdmin } from "../admin-client";
import { embedText } from "../../utils/embedding";
import type { InsertPendingNoteInput, RelevantKnowledgeNote } from "../../types/knowledge";

const KNOWLEDGE_TOP_K = 8;

// Bảng dùng chung không RLS, không lọc ngưỡng khoảng cách cứng để action agent tự đánh giá.
export async function findRelevantApprovedNotes(queryEmbedding: number[]): Promise<RelevantKnowledgeNote[]> {
  const embeddingLiteral = JSON.stringify(queryEmbedding);
  return dbAdmin
    .select({ id: knowledgeFiles.id, path: knowledgeFiles.path, title: knowledgeFiles.title, content: knowledgeFiles.content })
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.status, "approved"))
    .orderBy(sql`${knowledgeFiles.embedding} <=> ${embeddingLiteral}::vector`)
    .limit(KNOWLEDGE_TOP_K);
}

// Tính embedding ngay lúc tạo, không đợi duyệt, vì nội dung không đổi giữa 2 mốc đó.
export async function insertPendingNote(data: InsertPendingNoteInput) {
  const embedding = await embedText(`${data.title}\n${data.content}`);
  const [created] = await dbAdmin
    .insert(knowledgeFiles)
    .values({ ...data, status: "pending", embedding })
    .returning();
  return created;
}
