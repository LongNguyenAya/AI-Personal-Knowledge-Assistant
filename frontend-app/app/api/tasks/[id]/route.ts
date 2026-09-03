import { tasks, userCorrectionMemories } from "@ai-assistant/db/src/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { withAuthedContext } from "@/lib/with-authed-context";
import { withUserContext } from "@/lib/db-context";
import { getSettingValue } from "@/lib/settings";

function buildContextSignature(context?: Record<string, unknown> | null) {
  if (!context || Object.keys(context).length === 0) return "general";

  const normalized = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`);

  return normalized.length > 0 ? normalized.join("|") : "general";
}

export const PATCH = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const { id } = params;
  const payload = await req.json();
  const { isDone, title, sourceType, sourceId, entityType, fieldName, wrongValue, correctedValue, context, confidence } = payload as {
    isDone?: boolean;
    title?: string;
    sourceType?: string;
    sourceId?: string | null;
    entityType?: string | null;
    fieldName?: string;
    wrongValue?: string | null;
    correctedValue?: string | null;
    context?: Record<string, unknown> | null;
    confidence?: number | null;
  };

  const [existing] = await tx
    .select({ id: tasks.id, title: tasks.title, isDone: tasks.isDone })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .limit(1);

  if (!existing) return new Response("Not Found", { status: 404 });

  const updates: Partial<typeof tasks.$inferInsert> = {};
  if (typeof isDone === "boolean") updates.isDone = isDone;
  if (typeof title === "string") {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return new Response("Thiếu tiêu đề task", { status: 400 });
    updates.title = normalizedTitle;
  }

  if (Object.keys(updates).length === 0) {
    return new Response("Không có trường nào cần cập nhật", { status: 400 });
  }

  const [updated] = await tx.update(tasks).set(updates)
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id), isNull(tasks.deletedAt)))
    .returning();

  const shouldRecordCorrection =
    typeof sourceType === "string" &&
    sourceType.trim().length > 0 &&
    typeof fieldName === "string" &&
    fieldName.trim().length > 0 &&
    typeof title === "string" &&
    title.trim() !== existing.title &&
    (typeof wrongValue !== "undefined" || typeof correctedValue !== "undefined");

  // Ghi ở giao dịch độc lập, không lồng vào tx sửa task, vì transaction lồng (savepoint) làm ngữ cảnh RLS sai bên trong.
  if (shouldRecordCorrection) {
    try {
      await withUserContext(session.user.id, async (correctionTx) => {
        const contextSignature = buildContextSignature(context ?? null);
        // Mặc định đọc từ setting "manualCorrectionConfidence", vẫn cho phép caller tự truyền confidence riêng nếu có.
        const defaultConfidence = await getSettingValue("manualCorrectionConfidence");
        const nextConfidence = Math.max(0, Math.min(100, Number(confidence ?? defaultConfidence) || defaultConfidence));
        const existingCorrection = await correctionTx
          .select()
          .from(userCorrectionMemories)
          .where(
            and(
              eq(userCorrectionMemories.userId, session.user.id),
              eq(userCorrectionMemories.sourceType, sourceType),
              eq(userCorrectionMemories.fieldName, fieldName),
              eq(userCorrectionMemories.contextSignature, contextSignature),
              eq(userCorrectionMemories.status, "active")
            )
          )
          .orderBy(desc(userCorrectionMemories.updatedAt))
          .limit(1);

        if (existingCorrection[0]) {
          await correctionTx
            .update(userCorrectionMemories)
            .set({
              sourceId: sourceId ?? existingCorrection[0].sourceId,
              entityType: entityType ?? existingCorrection[0].entityType,
              wrongValue: wrongValue ?? existingCorrection[0].wrongValue,
              correctedValue: correctedValue ?? title.trim(),
              contextJson: context ?? existingCorrection[0].contextJson,
              confidence: Math.min(100, existingCorrection[0].confidence + nextConfidence),
              usageCount: existingCorrection[0].usageCount + 1,
              lastUsedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(userCorrectionMemories.id, existingCorrection[0].id));
        } else {
          await correctionTx.insert(userCorrectionMemories).values({
            userId: session.user.id,
            sourceType,
            sourceId: sourceId ?? null,
            entityType: entityType ?? null,
            fieldName,
            wrongValue: wrongValue ?? existing.title,
            correctedValue: correctedValue ?? title.trim(),
            contextSignature,
            contextJson: context ?? null,
            confidence: nextConfidence,
            status: "active",
            usageCount: 1,
            lastUsedAt: new Date(),
          });
        }
      });
    } catch (err) {
      console.error("[tasks] Không ghi được correction memory — không ảnh hưởng việc sửa task:", err);
    }
  }

  return Response.json(updated);
});

// Soft delete (set deletedAt), khác reminders (hard delete), vì cột deletedAt trên tasks vốn có sẵn cho việc này.
export const DELETE = withAuthedContext<{ id: string }>(async (req, { session, params, tx }) => {
  const { id } = params;
  const [deleted] = await tx.update(tasks).set({ deletedAt: new Date() })
    .where(and(eq(tasks.id, id), eq(tasks.userId, session.user.id)))
    .returning({ id: tasks.id });

  if (!deleted) return new Response("Not Found", { status: 404 });
  return Response.json({ success: true });
});
