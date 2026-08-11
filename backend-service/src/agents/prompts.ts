import { getActivePrompt } from "../db/repositories/agent-prompts";

export async function buildResearchAgentSystemPrompt(context: string) {
  const { systemPrompt } = await getActivePrompt("research");
  return systemPrompt.replaceAll("{{context}}", context);
}

export async function buildActionAgentSystemPrompt(currentDateUtc: string) {
  const { systemPrompt } = await getActivePrompt("action");
  const currentDateVn = new Date(currentDateUtc).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "full",
    timeStyle: "medium",
  });

  return systemPrompt.replaceAll("{{currentDateUtc}}", currentDateUtc).replaceAll("{{currentDateVn}}", currentDateVn);
}

export async function buildRouterPrompt(message: string) {
  const { systemPrompt } = await getActivePrompt("orchestrator");
  return systemPrompt.replaceAll("{{message}}", message);
}
