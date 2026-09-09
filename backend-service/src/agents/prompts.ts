import { getActivePrompt } from "../db/repositories/agent-prompts";
import { findRelevantApprovedNotes } from "../db/repositories/knowledge";
import { findActiveCorrectionHintsForUser, buildCorrectionHintPrompt } from "../db/repositories/correction-memories";
import { listDocuments } from "../db/repositories/documents";
import { getPersonalNote } from "../db/repositories/users";
import { getSettingValue } from "../db/repositories/settings";
import { embedText } from "../utils/embedding";

export async function buildResearchAgentSystemPrompt(context: string) {
  const { systemPrompt } = await getActivePrompt("research");
  return systemPrompt.replaceAll("{{context}}", context);
}

export async function buildActionAgentSystemPrompt(currentDateUtc: string, userMessage: string, userId: string) {
  const { systemPrompt } = await getActivePrompt("action");
  const currentDateVn = new Date(currentDateUtc).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "full",
    timeStyle: "medium",
  });

  // 1 embedding call per message, cheaper than tool-calling, the result goes straight into the prompt.
  const queryEmbedding = await embedText(userMessage);
  const relevantNotes = await findRelevantApprovedNotes(queryEmbedding);
  const knowledgeContext =
    relevantNotes.length === 0
      ? "(chưa có ghi chú kiến thức nào liên quan)"
      : relevantNotes.map((n) => `### [${n.path}] ${n.title}\n${n.content}`).join("\n\n");

  // Puts fileName+id directly into the prompt for the model to match itself, cheaper than a separate embedding call.
  const docs = await listDocuments(userId);
  const documentList =
    docs.length === 0
      ? "(user chưa có tài liệu nào)"
      : docs.map((d) => `- id: ${d.id} | tên file: ${d.fileName}`).join("\n");

  // Admin adjusts this via /admin/settings, higher means the AI remembers more but costs more tokens.
  const correctionHintLimit = Math.round(await getSettingValue("correctionHintLimit"));
  const correctionHints = await findActiveCorrectionHintsForUser(userId, correctionHintLimit);
  const correctionContext = buildCorrectionHintPrompt(
    correctionHints.map((hint) => ({
      fieldName: hint.fieldName,
      correctedValue: hint.correctedValue,
      sourceType: hint.sourceType,
    }))
  );

  // The user writes this once at /settings, always included, unlike correctionContext (only written on an event).
  const personalNote = await getPersonalNote(userId);
  const personalNoteContext = personalNote?.trim() ? personalNote.trim() : "(user chưa cung cấp thông tin cá nhân nào)";

  return systemPrompt
    .replaceAll("{{currentDateUtc}}", currentDateUtc)
    .replaceAll("{{currentDateVn}}", currentDateVn)
    .replaceAll("{{knowledgeContext}}", knowledgeContext)
    .replaceAll("{{documentList}}", documentList)
    .replaceAll("{{correctionContext}}", correctionContext)
    .replaceAll("{{personalNote}}", personalNoteContext);
}

export async function buildRouterPrompt(message: string) {
  const { systemPrompt } = await getActivePrompt("orchestrator");
  return systemPrompt.replaceAll("{{message}}", message);
}
