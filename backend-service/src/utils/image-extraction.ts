import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getActivePrompt } from "../db/repositories/agent-prompts";
import { getSettingValue } from "../db/repositories/settings";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

// Ngưỡng rất thấp có chủ đích, chỉ để bắt ca gần như rỗng, không phải ngưỡng đủ chi tiết.
const MIN_MEANINGFUL_LENGTH = 20;

async function callGemini(buffer: Buffer, mediaType: string, systemPrompt: string): Promise<string> {
  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          { type: "file", mediaType, data: buffer },
        ],
      },
    ],
    telemetry: { functionId: "image-extraction" },
  });
  return text ?? "";
}

export async function extractImageContent(buffer: Buffer, ext: string): Promise<string> {
  // Admin tự chỉnh qua /admin/settings, vẫn chặn ở đây để nhất quán dù ảnh thường nhỏ hơn PDF.
  const maxImageBytes = (await getSettingValue("maxUploadMb")) * 1024 * 1024;
  if (buffer.length > maxImageBytes) {
    throw new Error(`File ảnh quá lớn (${buffer.length} bytes) — vượt giới hạn ${maxImageBytes} bytes.`);
  }
  const mediaType = MIME_BY_EXT[ext];
  if (!mediaType) throw new Error(`Định dạng ảnh ".${ext}" không được hỗ trợ.`);

  const { systemPrompt } = await getActivePrompt("image_extraction");

  let text = await callGemini(buffer, mediaType, systemPrompt);
  // Kết quả gần như rỗng có thể chỉ là 1 lần chạy hụt, tự thử lại đúng 1 lần trước khi chấp nhận.
  if (text.trim().length < MIN_MEANINGFUL_LENGTH) {
    text = await callGemini(buffer, mediaType, systemPrompt);
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini không trích xuất được nội dung nào từ ảnh này.");
  }
  return text;
}
