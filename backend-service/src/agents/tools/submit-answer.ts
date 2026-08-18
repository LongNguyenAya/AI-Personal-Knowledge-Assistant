import { tool, generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";

// Model riêng, rẻ/nhanh, chỉ dùng cho việc so khớp — không cần model mạnh cho tác vụ nhị phân này.
// Cố tình dùng nhà cung cấp KHÁC Gemini (không phải để né rate-limit — dùng free tier riêng của
// Groq cho đúng mục đích của họ), tách biệt hoàn toàn khỏi quota chính đang dùng cho sinh câu trả lời.
// PHẢI là openai/gpt-oss-20b (hoặc -120b) — đây là 2 model DUY NHẤT trên Groq hỗ trợ
// response_format json_schema mà generateObject cần; llama-3.1-8b-instant trả lỗi 400 ngay lập tức.
const VERIFICATION_MODEL = "openai/gpt-oss-20b";

// Lớp kiểm tra THỨ 2, sau khi đã qua kiểm tra ID (citedDocumentIds có tồn tại) — lớp này kiểm tra
// NỘI DUNG câu trả lời có thực sự được suy ra đúng từ nguồn hay không (lỗi loại 1/2: gán nhầm ý,
// pha trộn kiến thức ngoài nguồn), thứ kiểm tra ID không bắt được. Fail gracefully — nếu Groq lỗi/
// rate-limit, KHÔNG chặn câu trả lời chính, vì lớp kiểm tra ID (code thuần, không phụ thuộc Groq)
// vẫn đang bảo vệ độc lập.
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

// Bắt buộc research agent trả lời qua tool này (toolChoice ép trong research-node.ts) thay vì
// text tự do — cho phép code kiểm tra citedDocumentIds trước khi chấp nhận câu trả lời, thay vì
// tin lời model tự nói đã dùng nguồn nào. So sánh tập hợp thuần (0 lệnh gọi AI) — nếu có ID lạ,
// trả lỗi để model tự viết lại ở bước sau (retry qua multi-step, không phải lệnh gọi AI mới).
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

// toolChoice ép gọi submitAnswer MỖI bước (không có cách nào để model tự "kết thúc lượt" bằng
// text thường) — nên nếu chỉ dùng stepCountIs(3) làm điều kiện dừng DUY NHẤT, model bị buộc phải
// gọi submitAnswer đủ 3 LẦN dù lần đầu đã accepted=true, tốn gấp 3 lệnh gọi Gemini (và cả Groq,
// nếu có trích nguồn) một cách vô ích — phát hiện được qua Langfuse (3 GENERATION + 3 TOOL call
// cho 1 câu hỏi vốn chỉ cần 1). Thêm điều kiện dừng SỚM này để kết hợp cùng stepCountIs(3) (dùng
// dạng mảng, dừng khi có 1 điều kiện đúng): dừng ngay khi bước gần nhất đã accepted=true.
export function stopWhenAnswerAccepted({ steps }: { steps: { toolResults: { toolName: string; output: unknown }[] }[] }): boolean {
  const lastStep = steps[steps.length - 1];
  return lastStep?.toolResults.some(
    (tr) => tr.toolName === "submitAnswer" && (tr.output as { accepted: boolean })?.accepted === true
  ) ?? false;
}

// toolResults của generateText đã có sẵn cả input (args gốc) lẫn output (kết quả execute) cho mỗi
// lần gọi — không cần dò riêng mảng toolCalls để khớp toolCallId.
// Trả kèm citedDocumentIds (không chỉ answer) — bên gọi cần nó để lọc lại phần "Nguồn" hiện cho
// user đúng bằng những gì model THỰC SỰ trích (đã qua kiểm tra), không phải mọi tài liệu đã truy
// xuất — 2 tập này khác nhau, nhầm lẫn giữa chúng từng khiến "Nguồn" hiện cả tài liệu không liên
// quan, kể cả khi model từ chối trả lời vì không tìm thấy thông tin.
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
