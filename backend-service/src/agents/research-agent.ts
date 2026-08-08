import { google } from "@ai-sdk/google";
import { streamText, createUIMessageStream } from "ai";
import { retrieveRelevantChunks } from "./retrieval";
import { RESEARCH_AGENT_SYSTEM_PROMPT } from "./prompts";

export async function runResearchAgent(question: string, userId: string) {
  const { context, sources } = await retrieveRelevantChunks(question, userId);

  return createUIMessageStream({
    execute: ({ writer }) => {
      for (const s of sources) {
        writer.write({ type: "source-document", sourceId: s.documentId, mediaType: "text/plain", title: s.fileName, filename: s.fileName });
      }

      const result = streamText({
        model: google("gemini-flash-latest"),
        system: RESEARCH_AGENT_SYSTEM_PROMPT(context),
        prompt: question,
      });

      writer.merge(result.toUIMessageStream());
    },
  });
}
