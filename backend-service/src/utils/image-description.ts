import { generateText } from "ai";
import { google } from "@ai-sdk/google";

const PROMPT =
  "Mô tả ngắn gọn (1-2 câu) nội dung/ý nghĩa của hình ảnh này bằng tiếng Việt — tập trung vào " +
  "thông tin thực sự có trong ảnh (số liệu, biểu đồ, sơ đồ, ảnh chụp...), không suy đoán thêm " +
  "ngoài những gì nhìn thấy được.";

// Tách riêng khỏi extractPdfContent vì .docx/.pptx đọc cục bộ nên ảnh nhúng phải tách ra mô tả riêng.
export async function describeImage(buffer: Buffer, mediaType: string): Promise<string> {
  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "file", mediaType, data: buffer }] }],
    telemetry: { functionId: "image-description" },
  });
  return text.trim();
}
