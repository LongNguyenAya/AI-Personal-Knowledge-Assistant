import { users } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

// users doesn't have RLS enabled so it must filter where(eq(users.id, session.user.id)) explicitly, otherwise another user's personalNote could be read/edited.
export const GET = withAuthedContext(async (_req, { session, tx }) => {
  const [row] = await tx.select({ personalNote: users.personalNote }).from(users).where(eq(users.id, session.user.id));
  return Response.json({ personalNote: row?.personalNote ?? "" });
});

const MAX_NOTE_LENGTH = 2000;

export const PATCH = withAuthedContext(async (req, { session, tx }) => {
  const body = await req.json().catch(() => null);
  const personalNote = body?.personalNote;
  if (typeof personalNote !== "string") {
    return new Response("Missing personalNote or wrong data type", { status: 400 });
  }
  if (personalNote.length > MAX_NOTE_LENGTH) {
    return new Response(`Note is too long, max ${MAX_NOTE_LENGTH} characters`, { status: 400 });
  }

  await tx
    .update(users)
    .set({ personalNote: personalNote.trim() || null })
    .where(eq(users.id, session.user.id));

  return Response.json({ success: true });
});
