import { conversations } from "@ai-assistant/db/src/schema";
import { eq, desc } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";

// Trả về toàn bộ conversation của user, mới nhất trước, trang /chat tự chọn phần tử đầu tiên làm active.
export const GET = withAuthedContext(async (req, { session, tx }) => {
  const list = await tx
    .select()
    .from(conversations)
    .where(eq(conversations.userId, session.user.id))
    .orderBy(desc(conversations.createdAt));

  return Response.json(list);
});

// Luôn tạo 1 conversation mới, dùng bởi nút "Cuộc trò chuyện mới".
export const POST = withAuthedContext(async (req, { session, tx }) => {
  const [created] = await tx.insert(conversations).values({ userId: session.user.id }).returning();
  return Response.json(created);
});
