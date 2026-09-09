import { agentPrompts, agentTypeEnum, adminAuditLog, type AgentType } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

export const POST = withAdminContext<{ agentType: string }>(async (req, { db, session, params }) => {
  const agentType = params.agentType as AgentType;
  if (!agentTypeEnum.enumValues.includes(agentType)) {
    return new Response("Invalid agentType", { status: 400 });
  }

  const { systemPrompt } = await req.json();
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
    return new Response("Bad Request", { status: 400 });
  }

  // Must deactivate the old active version before inserting the new one, since the unique index only allows 1 isActive=true row per agentType.
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ version: agentPrompts.version })
      .from(agentPrompts)
      .where(and(eq(agentPrompts.agentType, agentType), eq(agentPrompts.isActive, true)));

    await tx
      .update(agentPrompts)
      .set({ isActive: false })
      .where(and(eq(agentPrompts.agentType, agentType), eq(agentPrompts.isActive, true)));

    await tx.insert(agentPrompts).values({
      agentType,
      systemPrompt,
      updatedBy: session.user.id,
      version: (current?.version ?? 0) + 1,
      isActive: true,
    });

    await tx.insert(adminAuditLog).values({
      adminId: session.user.id,
      action: `agent_prompt.update:${agentType}`,
      targetUserId: null,
    });
  });

  return Response.json({ ok: true });
});
