import { and, desc, eq } from "drizzle-orm";
import { userCorrectionMemories } from "@ai-assistant/db/src/schema";
import { withUserContext } from "../context";

export type CorrectionMemoryContext = Record<string, unknown> | null | undefined;

export type RecordCorrectionMemoryInput = {
  userId: string;
  sourceType: string;
  sourceId?: string | null;
  entityType?: string | null;
  fieldName: string;
  wrongValue?: string | null;
  correctedValue?: string | null;
  context?: CorrectionMemoryContext;
  confidence?: number;
  // active là correction người dùng tự sửa (có hiệu lực ngay), inactive là AI tự đề xuất (chờ duyệt).
  status?: "active" | "inactive" | "dismissed" | "expired";
};

export type FindRelevantCorrectionHintsInput = {
  userId: string;
  sourceType: string;
  fieldName: string;
  context?: CorrectionMemoryContext;
  limit?: number;
};

export function buildCorrectionContextSignature(context?: CorrectionMemoryContext): string {
  if (!context || Object.keys(context).length === 0) return "general";

  const normalized = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`);

  return normalized.length > 0 ? normalized.join("|") : "general";
}

export async function recordCorrectionMemory(input: RecordCorrectionMemoryInput) {
  const contextSignature = buildCorrectionContextSignature(input.context);
  const confidenceBoost = Math.max(0, Math.min(100, input.confidence ?? 80));

  return withUserContext(input.userId, async (tx) => {
    // Chỉ tìm bản ghi active để gộp confidence, quan sát AI (inactive) luôn tạo dòng mới không gộp.
    const existing = await tx
      .select()
      .from(userCorrectionMemories)
      .where(
        and(
          eq(userCorrectionMemories.userId, input.userId),
          eq(userCorrectionMemories.sourceType, input.sourceType),
          eq(userCorrectionMemories.fieldName, input.fieldName),
          eq(userCorrectionMemories.contextSignature, contextSignature),
          eq(userCorrectionMemories.status, "active")
        )
      )
      .orderBy(desc(userCorrectionMemories.updatedAt))
      .limit(1);

    if (existing[0]) {
      const [updated] = await tx
        .update(userCorrectionMemories)
        .set({
          sourceId: input.sourceId ?? existing[0].sourceId,
          entityType: input.entityType ?? existing[0].entityType,
          wrongValue: input.wrongValue ?? existing[0].wrongValue,
          correctedValue: input.correctedValue ?? existing[0].correctedValue,
          contextJson: input.context ?? existing[0].contextJson,
          confidence: Math.min(100, existing[0].confidence + confidenceBoost),
          usageCount: existing[0].usageCount + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userCorrectionMemories.id, existing[0].id))
        .returning();

      return updated;
    }

    const [created] = await tx
      .insert(userCorrectionMemories)
      .values({
        userId: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        entityType: input.entityType ?? null,
        fieldName: input.fieldName,
        wrongValue: input.wrongValue ?? null,
        correctedValue: input.correctedValue ?? null,
        contextSignature,
        contextJson: input.context ?? null,
        confidence: confidenceBoost,
        status: input.status ?? "active",
        usageCount: 1,
        lastUsedAt: new Date(),
      })
      .returning();

    return created;
  });
}

export async function findRelevantCorrectionHints(input: FindRelevantCorrectionHintsInput) {
  const limit = input.limit ?? 5;
  const contextSignature = buildCorrectionContextSignature(input.context);

  return withUserContext(input.userId, (tx) =>
    tx
      .select()
      .from(userCorrectionMemories)
      .where(
        and(
          eq(userCorrectionMemories.userId, input.userId),
          eq(userCorrectionMemories.sourceType, input.sourceType),
          eq(userCorrectionMemories.fieldName, input.fieldName),
          eq(userCorrectionMemories.status, "active"),
          eq(userCorrectionMemories.contextSignature, contextSignature)
        )
      )
      .orderBy(desc(userCorrectionMemories.confidence), desc(userCorrectionMemories.usageCount))
      .limit(limit)
  );
}

export async function findActiveCorrectionHintsForUser(userId: string, limit = 8) {
  return withUserContext(userId, (tx) =>
    tx
      .select()
      .from(userCorrectionMemories)
      .where(and(eq(userCorrectionMemories.userId, userId), eq(userCorrectionMemories.status, "active")))
      .orderBy(desc(userCorrectionMemories.confidence), desc(userCorrectionMemories.usageCount), desc(userCorrectionMemories.updatedAt))
      .limit(limit)
  );
}

export function buildCorrectionHintPrompt(hints: { fieldName: string; correctedValue: string | null; sourceType: string }[]) {
  if (hints.length === 0) return "";

  const items = hints
    .map((hint) => `- ${hint.sourceType} / ${hint.fieldName}: user từng sửa thành ${hint.correctedValue ?? "giá trị mới nhất"}`)
    .join("\n");

  return `\nLưu ý về chỉnh sửa trước đó của user:\n${items}\nHãy kiểm tra kỹ trường tương tự trước khi trả kết quả.\n`;
}
