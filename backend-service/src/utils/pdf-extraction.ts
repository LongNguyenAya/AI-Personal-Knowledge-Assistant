import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getActivePrompt } from "../db/repositories/agent-prompts";
import { getSettingValue } from "../db/repositories/settings";

// Ngưỡng rất thấp có chủ đích, chỉ để bắt ca gần như rỗng, không phải ngưỡng đủ chi tiết.
const MIN_MEANINGFUL_LENGTH = 20;

async function callGemini(buffer: Buffer, systemPrompt: string): Promise<string> {
  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          { type: "file", mediaType: "application/pdf", data: buffer },
        ],
      },
    ],
    telemetry: { functionId: "pdf-extraction" },
  });
  return text ?? "";
}

// Gửi thẳng PDF cho Gemini, model tự đọc từng trang như ảnh, hiểu cả text lẫn hình trong 1 lệnh gọi.
export async function extractPdfContent(buffer: Buffer): Promise<string> {
  // Admin tự chỉnh qua /admin/settings, giới hạn thật là do request inline PDF của Gemini, không vượt 15MB.
  const maxPdfBytes = (await getSettingValue("maxUploadMb")) * 1024 * 1024;
  if (buffer.length > maxPdfBytes) {
    throw new Error(`File PDF quá lớn (${buffer.length} bytes) — vượt giới hạn ${maxPdfBytes} bytes cho inline PDF của Gemini.`);
  }

  const { systemPrompt } = await getActivePrompt("pdf_extraction");

  let text = await callGemini(buffer, systemPrompt);
  // Kết quả gần như rỗng có thể chỉ là 1 lần chạy hụt, tự thử lại đúng 1 lần trước khi chấp nhận.
  if (text.trim().length < MIN_MEANINGFUL_LENGTH) {
    text = await callGemini(buffer, systemPrompt);
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini không trích xuất được nội dung nào từ file PDF này.");
  }
  return text;
}
