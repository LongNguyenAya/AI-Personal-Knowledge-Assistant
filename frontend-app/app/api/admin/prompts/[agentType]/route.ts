import { agentPrompts, agentTypeEnum, adminAuditLog } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAdminContext } from "@/lib/with-admin-context";

type AgentType = (typeof agentTypeEnum.enumValues)[number];

export const POST = withAdminContext<{ agentType: string }>(async (req, { db, session, params }) => {
  const agentType = params.agentType as AgentType;
  if (!agentTypeEnum.enumValues.includes(agentType)) {
    return new Response("Invalid agentType", { status: 400 });
  }

  const { systemPrompt } = await req.json();
  if (typeof systemPrompt !== "string" || !systemPrompt.trim()) {
    return new Response("Bad Request", { status: 400 });
  }

  // Phải deactivate bản active cũ trước khi insert bản mới — unique index
  // agent_prompts_one_active_per_type chỉ cho 1 bản isActive=true mỗi agentType, làm ngược lại
  // sẽ vi phạm constraint ngay.
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
