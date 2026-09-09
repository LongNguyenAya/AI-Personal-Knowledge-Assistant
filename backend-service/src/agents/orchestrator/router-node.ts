import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { buildRouterPrompt } from "../prompts";

// Only needs state.message, declared with a narrow type so this function can be called standalone outside the graph.
export async function routerNode(state: { message: string }) {
  const prompt = await buildRouterPrompt(state.message);

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    prompt,
    temperature: 0,
    telemetry: { functionId: "router-node" },
  });
  const label = text.trim().toLowerCase();

  const validLabels = ["research", "action", "both", "unknown"];
  const route = validLabels.includes(label) ? label : "unknown";

  return { route };
}
