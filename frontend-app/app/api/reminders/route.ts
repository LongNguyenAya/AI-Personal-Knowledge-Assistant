import { db } from "@/lib/db";
import { reminders } from "@ai-assistant/db/src/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const list = await db.select().from(reminders).orderBy(desc(reminders.createdAt));
  return Response.json(list);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { title, content, dueAt } = await req.json();

  const [created] = await db.insert(reminders).values({
    userId: session.user.id,
    title,
    content,
    dueAt: new Date(dueAt),
    source: "manual",
  }).returning();

  return Response.json(created);
}