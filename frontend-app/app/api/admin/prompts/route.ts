import { agentPrompts } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

export const GET = withAdminContext(async (_req, { db }) => {
  const active = await db.select().from(agentPrompts).where(eq(agentPrompts.isActive, true));
  return Response.json(active);
});
