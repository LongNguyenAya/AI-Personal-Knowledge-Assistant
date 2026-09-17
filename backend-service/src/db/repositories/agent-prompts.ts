import { agentPrompts, type AgentType } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { dbAdmin } from "../admin-client";

// agent_prompts is shared and belongs to no user so it has no RLS, read through dbAdmin for consistency.
export async function getActivePrompt(agentType: AgentType) {
  const [row] = await dbAdmin
    .select()
    .from(agentPrompts)
    .where(and(eq(agentPrompts.agentType, agentType), eq(agentPrompts.isActive, true)));

  if (!row) {
    throw new Error(`Không tìm thấy active prompt cho agentType=${agentType}, cần chạy seed dữ liệu ban đầu.`);
  }
  return row;
}
