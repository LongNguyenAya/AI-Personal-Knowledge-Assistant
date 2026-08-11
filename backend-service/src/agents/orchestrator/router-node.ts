import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { buildRouterPrompt } from "../prompts";

// Chỉ cần state.message — khai báo kiểu hẹp thay vì toàn bộ OrchestratorState.State để
// có thể gọi hàm này độc lập (ngoài graph, không qua .invoke()) trong route streaming.
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
