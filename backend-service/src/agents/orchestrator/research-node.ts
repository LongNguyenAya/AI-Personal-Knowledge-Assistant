import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "../../db/client";
import { chunks, documents } from "@ai-assistant/db/src/schema";
import { sql, eq } from "drizzle-orm";
import { embedText } from "../../utils/embedding";
import { RESEARCH_AGENT_SYSTEM_PROMPT } from "../prompts";
import { OrchestratorState } from "./state";

export async function researchNode(state: typeof OrchestratorState.State) {
  const embedding = await embedText(state.message);

  const relevantChunks = await db
    .select({ content: chunks.content })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(eq(documents.userId, state.userId))
    .orderBy(sql`${chunks.embedding} <=> ${JSON.stringify(embedding)}::vector`)
    .limit(5);

  const context = relevantChunks.map((c) => c.content).join("\n\n---\n\n");

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: RESEARCH_AGENT_SYSTEM_PROMPT(context),
    prompt: state.message,
  });

  return { researchResult: text };
}