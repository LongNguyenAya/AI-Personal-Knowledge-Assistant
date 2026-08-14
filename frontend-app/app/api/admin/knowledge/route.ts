import { knowledgeFiles, knowledgeStatusEnum, type KnowledgeStatus } from "@ai-assistant/db/src/schema";
import { desc, eq } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

export const GET = withAdminContext(async (req, { db }) => {
  const statusParam = new URL(req.url).searchParams.get("status");
  if (statusParam && !knowledgeStatusEnum.enumValues.includes(statusParam as KnowledgeStatus)) {
    return new Response("Invalid status", { status: 400 });
  }

  const rows = statusParam
    ? await db
        .select()
        .from(knowledgeFiles)
        .where(eq(knowledgeFiles.status, statusParam as KnowledgeStatus))
        .orderBy(desc(knowledgeFiles.createdAt))
    : await db.select().from(knowledgeFiles).orderBy(desc(knowledgeFiles.createdAt));

  return Response.json(rows);
});
