import { userCorrectionMemories } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

const ALLOWED_TARGET_STATUSES = ["active", "dismissed", "inactive"] as const;

// Approves ("active") or dismisses ("dismissed") an AI-suggested note, or resets it to "inactive" to undo, "expired" isn't allowed through this route.
export const PATCH = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!ALLOWED_TARGET_STATUSES.includes(status)) {
    return new Response(`status must be "active", "dismissed", or "inactive"`, { status: 400 });
  }

  const [updated] = await tx
    .update(userCorrectionMemories)
    .set({ status })
    .where(and(eq(userCorrectionMemories.id, params.id), eq(userCorrectionMemories.userId, session.user.id)))
    .returning();

  if (!updated) return new Response("Not Found", { status: 404 });
  return Response.json(updated);
});
