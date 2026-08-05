import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { db } from "../db/client";
import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq } from "drizzle-orm";
import { embedText } from "../utils/embedding";
import { RESEARCH_AGENT_SYSTEM_PROMPT } from "./prompts";

export async function runResearchAgent(question: string, userId: string) {
  const questionEmbedding = await embedText(question);

  const relevantChunks = await db
    .select({
      content: chunks.content,
      distance: sql<number>`${chunks.embedding} <=> ${JSON.stringify(questionEmbedding)}::vector`,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(eq(documents.userId, userId))
    .orderBy(sql`${chunks.embedding} <=> ${JSON.stringify(questionEmbedding)}::vector`)
    .limit(5);

  const context = relevantChunks.map((c) => c.content).join("\n\n---\n\n");

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: RESEARCH_AGENT_SYSTEM_PROMPT(context),
    prompt: question,
  });

  return result;
}