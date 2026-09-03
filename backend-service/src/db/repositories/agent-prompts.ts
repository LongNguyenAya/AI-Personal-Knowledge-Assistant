import { agentPrompts, type AgentType } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { dbAdmin } from "../admin-client";

// agent_prompts dùng chung, không thuộc user nào nên không RLS, đọc qua dbAdmin cho nhất quán.
export async function getActivePrompt(agentType: AgentType) {
  const [row] = await dbAdmin
    .select()
    .from(agentPrompts)
    .where(and(eq(agentPrompts.agentType, agentType), eq(agentPrompts.isActive, true)));

  if (!row) {
    throw new Error(`Không tìm thấy active prompt cho agentType=${agentType} — cần chạy seed dữ liệu ban đầu.`);
  }
  return row;
}
