import { conversations } from "@ai-assistant/db/src/schema";
import { eq, desc } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

// Returns all of the user's conversations, newest first, the /chat page picks the first item as active itself.
export const GET = withAuthedContext(async (req, { session, tx }) => {
  const list = await tx
    .select()
    .from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(desc(conversations.createdAt));

  return Response.json(list);
});

// Always creates 1 new conversation, used by the "New conversation" button.
export const POST = withAuthedContext(async (req, { session, tx }) => {
  const [created] = await tx.insert(conversations).values({ userId: session.user.id }).returning();
  return Response.json(created);
});
