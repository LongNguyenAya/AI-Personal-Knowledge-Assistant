import { knowledgeFiles } from "@ai-assistant/db/src/schema";
import { eq, sql } from "drizzle-orm";
import { dbAdmin } from "../admin-client";
import { embedText } from "../../utils/embedding";
import type { InsertPendingNoteInput, RelevantKnowledgeNote } from "../../types/knowledge";

const KNOWLEDGE_TOP_K = 8;

// knowledge_files là bảng dùng chung, không thuộc về user nào nên không có RLS — đọc qua dbAdmin,
// giống agent_prompts. Không lọc theo ngưỡng khoảng cách vector cứng — để action agent tự đánh giá
// ghi chú trả về có thực sự liên quan hay không, giống cách searchDocuments tự lọc chunk không liên quan.
export async function findRelevantApprovedNotes(queryEmbedding: number[]): Promise<RelevantKnowledgeNote[]> {
  const embeddingLiteral = JSON.stringify(queryEmbedding);
  return dbAdmin
    .select({ id: knowledgeFiles.id, path: knowledgeFiles.path, title: knowledgeFiles.title, content: knowledgeFiles.content })
    .from(knowledgeFiles)
    .where(eq(knowledgeFiles.status, "approved"))
    .orderBy(sql`${knowledgeFiles.embedding} <=> ${embeddingLiteral}::vector`)
    .limit(KNOWLEDGE_TOP_K);
}

// Note CHƯA có embedding lúc propose thì sau này sẽ không bao giờ được tìm thấy — tính embedding
// ngay tại đây (lúc tạo), không đợi tới lúc duyệt, vì nội dung không đổi giữa 2 mốc đó.
export async function insertPendingNote(data: InsertPendingNoteInput) {
  const embedding = await embedText(`${data.title}\n${data.content}`);
  const [created] = await dbAdmin
    .insert(knowledgeFiles)
    .values({ ...data, status: "pending", embedding })
    .returning();
  return created;
}
