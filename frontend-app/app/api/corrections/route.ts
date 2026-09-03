import { and, count, desc, eq } from "drizzle-orm";
import { userCorrectionMemories } from "@ai-assistant/db/src/schema";
import { withAuthedContext } from "@/lib/with-authed-context";
import { getSettingValue } from "@/lib/settings";

function buildContextSignature(context?: Record<string, unknown> | null) {
  if (!context || Object.keys(context).length === 0) return "general";

  const normalized = Object.entries(context)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`);

  return normalized.length > 0 ? normalized.join("|") : "general";
}

export const POST = withAuthedContext(async (req, { session, tx }) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const {
    sourceType,
    sourceId,
    entityType,
    fieldName,
    wrongValue,
    correctedValue,
    context,
    confidence,
  } = body as {
    sourceType?: string;
    sourceId?: string | null;
    entityType?: string | null;
    fieldName?: string;
    wrongValue?: string | null;
    correctedValue?: string | null;
    context?: Record<string, unknown> | null;
    confidence?: number | null;
  };

  if (typeof sourceType !== "string" || sourceType.trim().length === 0) {
    return new Response("Thiếu sourceType", { status: 400 });
  }
  if (typeof fieldName !== "string" || fieldName.trim().length === 0) {
    return new Response("Thiếu fieldName", { status: 400 });
  }
  if (typeof wrongValue === "undefined" && typeof correctedValue === "undefined") {
    return new Response("Cần ít nhất một trong wrongValue hoặc correctedValue", { status: 400 });
  }
  if (wrongValue === correctedValue) {
    return new Response("wrongValue và correctedValue không được giống nhau", { status: 400 });
  }

  const contextSignature = buildContextSignature(context ?? null);
  // Mặc định đọc từ setting "manualCorrectionConfidence" (admin tự chỉnh), giống tasks/[id]/route.ts.
  const defaultConfidence = await getSettingValue("manualCorrectionConfidence");
  const nextConfidence = Math.max(0, Math.min(100, Number(confidence ?? defaultConfidence) || defaultConfidence));

  const existing = await tx
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

  if (existing[0]) {
    const [updated] = await tx
      .update(userCorrectionMemories)
      .set({
        sourceId: sourceId ?? existing[0].sourceId,
        entityType: entityType ?? existing[0].entityType,
        wrongValue: wrongValue ?? existing[0].wrongValue,
        correctedValue: correctedValue ?? existing[0].correctedValue,
        contextJson: context ?? existing[0].contextJson,
        confidence: Math.min(100, existing[0].confidence + nextConfidence),
        usageCount: existing[0].usageCount + 1,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userCorrectionMemories.id, existing[0].id))
      .returning();

    return Response.json(updated);
  }

  const [created] = await tx
    .insert(userCorrectionMemories)
    .values({
      userId: session.user.id,
      sourceType,
      sourceId: sourceId ?? null,
      entityType: entityType ?? null,
      fieldName,
      wrongValue: wrongValue ?? null,
      correctedValue: correctedValue ?? null,
      contextSignature,
      contextJson: context ?? null,
      confidence: nextConfidence,
      status: "active",
      usageCount: 1,
      lastUsedAt: new Date(),
    })
    .returning();

  return Response.json(created);
});

const VALID_STATUSES = ["active", "inactive", "dismissed", "expired"] as const;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Phân trang thật (page/pageSize + total), route này chỉ phục vụ trang /corrections, AI tự query hint qua đường khác.
export const GET = withAuthedContext(async (req, { session, tx }) => {
  const url = new URL(req.url);
  const sourceType = url.searchParams.get("sourceType");
  const fieldName = url.searchParams.get("fieldName");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));
  // Mặc định "active" giữ hành vi cũ cho chỗ gọi không truyền status, "inactive" dùng cho trang duyệt ghi chú AI tự đề xuất.
  const statusParam = url.searchParams.get("status");
  const status = (VALID_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as (typeof VALID_STATUSES)[number]) : "active";

  const where = [
    eq(userCorrectionMemories.userId, session.user.id),
    eq(userCorrectionMemories.status, status),
  ];

  if (sourceType) where.push(eq(userCorrectionMemories.sourceType, sourceType));
  if (fieldName) where.push(eq(userCorrectionMemories.fieldName, fieldName));

  const [corrections, [{ total }]] = await Promise.all([
    tx
      .select()
      .from(userCorrectionMemories)
      .where(and(...where))
      .orderBy(desc(userCorrectionMemories.confidence), desc(userCorrectionMemories.usageCount), desc(userCorrectionMemories.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    tx.select({ total: count() }).from(userCorrectionMemories).where(and(...where)),
  ]);

  return Response.json({ corrections, total, page, pageSize });
});
