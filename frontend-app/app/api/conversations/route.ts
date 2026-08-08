import { conversations } from "@ai-assistant/db/src/schema";
import { eq, desc } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

// Trả về conversation gần nhất của user, tạo mới nếu chưa từng chat lần nào — dùng lúc
// trang /chat mount để biết "cuộc hội thoại đang active" là cái nào.
export const GET = withAuthedContext(async (req, { session, tx }) => {
  const [existing] = await tx
    .select()
    .from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(desc(conversations.createdAt))
    .limit(1);

  if (existing) return Response.json(existing);

  const [created] = await tx.insert(conversations).values({ userId: session.user.id }).returning();
  return Response.json(created);
});

// Luôn tạo 1 conversation MỚI — dùng bởi nút "Cuộc trò chuyện mới".
export const POST = withAuthedContext(async (req, { session, tx }) => {
  const [created] = await tx.insert(conversations).values({ userId: session.user.id }).returning();
  return Response.json(created);
});
