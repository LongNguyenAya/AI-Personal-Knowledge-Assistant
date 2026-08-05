import { db } from "@/lib/db";
import { reminders } from "@ai-assistant/db/src/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const [updated] = await db.update(reminders).set(body).where(eq(reminders.id, id)).returning();
  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  await db.delete(reminders).where(eq(reminders.id, id));
  return Response.json({ success: true });
}