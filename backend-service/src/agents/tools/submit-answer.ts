import { tool, generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";

// Model riêng (Groq), rẻ và nhanh, openai/gpt-oss-20b là 1 trong 2 model Groq hỗ trợ json_schema.
const VERIFICATION_MODEL = "openai/gpt-oss-20b";

// Lớp kiểm tra thứ 2, xem nội dung có suy ra đúng từ nguồn không, fail gracefully nếu Groq lỗi.
async function verifyContentMatch(answer: string, sourceContents: string[]): Promise<{ supported: boolean; reason: string | null }> {
  if (sourceContents.length === 0) return { supported: true, reason: null };

  try {
    const { object } = await generateObject({
      model: groq(VERIFICATION_MODEL),
      schema: z.object({
        supported: z.boolean().describe("true nếu câu trả lời thực sự được suy ra đúng từ nguồn, false nếu có chi tiết bịa thêm/sai lệch so với nguồn"),
        reason: z.string().nullable().describe("giải thích ngắn gọn lý do nếu supported=false, null nếu supported=true"),
      }),
      prompt:
        `So sánh câu trả lời với nguồn bên dưới — câu trả lời có thực sự dựa đúng vào nội dung ` +
        `nguồn, không bịa thêm chi tiết nào không?\n\nNguồn:\n${sourceContents.join("\n---\n")}\n\n` +
        `Câu trả lời cần kiểm tra:\n${answer}`,
      telemetry: { functionId: "content-verification" },
    });
    return object;
  } catch (err) {
    console.error("[content-verification] Bỏ qua bước kiểm tra do lỗi gọi Groq:", err);
    return { supported: true, reason: null };
  }
}

// Ép trả lời qua tool này để code kiểm tra citedDocumentIds thật, ID lạ thì trả lỗi cho model viết lại.
export function submitAnswerTool(contentsByDocumentId: Map<string, string[]>) {
  const retrievedDocumentIds = new Set(contentsByDocumentId.keys());

  return tool({
    description:
      "Gửi câu trả lời cuối cùng cho user. BẮT BUỘC liệt kê đúng documentId đã thực sự dùng để " +
      "trả lời trong citedDocumentIds — chỉ được liệt kê ID có trong nhãn [documentId: ...] ở " +
      "context, TUYỆT ĐỐI không bịa thêm ID khác hoặc đoán ID không thấy trong context.",
    inputSchema: z.object({
      answer: z.string().describe("Câu trả lời đầy đủ, tự nhiên cho user, dựa trên context được cung cấp."),
      citedDocumentIds: z
        .array(z.string())
        .describe("documentId của các nguồn thực sự dùng để trả lời — để mảng rỗng nếu không dựa vào tài liệu nào."),
    }),
    execute: async ({ answer, citedDocumentIds }) => {
      const invalid = citedDocumentIds.filter((id) => !retrievedDocumentIds.has(id));
      if (invalid.length > 0) {
        return {
          accepted: false as const,
          error: `citedDocumentIds chứa ID chưa từng xuất hiện trong context: ${invalid.join(", ")}. Chỉ trích những ID có nhãn [documentId: ...] thật trong context — viết lại answer và citedDocumentIds cho đúng.`,
        };
      }

      const citedContents = citedDocumentIds.flatMap((id) => contentsByDocumentId.get(id) ?? []);
      const { supported, reason } = await verifyContentMatch(answer, citedContents);
      if (!supported) {
        return {
          accepted: false as const,
          error: `Nội dung câu trả lời có vẻ không khớp với nguồn đã trích${reason ? ` (${reason})` : ""}. Đọc lại đúng nội dung nguồn và viết lại answer cho chính xác, không thêm chi tiết ngoài nguồn.`,
        };
      }

      return { accepted: true as const };
    },
  });
}

// Thiếu điều kiện dừng sớm này, model bị buộc gọi đủ 3 lần dù đã accepted từ lần đầu.
export function stopWhenAnswerAccepted({ steps }: { steps: { toolResults: { toolName: string; output: unknown }[] }[] }): boolean {
  const lastStep = steps[steps.length - 1];
  return lastStep?.toolResults.some(
    (tr) => tr.toolName === "submitAnswer" && (tr.output as { accepted: boolean })?.accepted === true
  ) ?? false;
}

// Trả kèm citedDocumentIds để hiện đúng "Nguồn", tránh nhầm với tập "đã truy xuất" từng hiện sai.
export function extractGroundedAnswer(
  toolResults: { toolName: string; input: unknown; output: unknown }[]
): { answer: string; citedDocumentIds: string[] } | null {
  for (let i = toolResults.length - 1; i >= 0; i--) {
    const tr = toolResults[i];
    if (tr.toolName !== "submitAnswer") continue;
    const output = tr.output as { accepted: boolean };
    if (output.accepted) {
      const input = tr.input as { answer: string; citedDocumentIds: string[] };
      return { answer: input.answer, citedDocumentIds: input.citedDocumentIds };
    }
  }
  return null;
}
