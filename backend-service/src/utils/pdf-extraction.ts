import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getActivePrompt } from "../db/repositories/agent-prompts";

// ~20MB sau base64 (x1.37) — giới hạn request inline PDF của Gemini.
const MAX_PDF_BYTES = 15 * 1024 * 1024;

// Gửi thẳng PDF cho Gemini — model tự đọc từng trang như ảnh, hiểu cả text lẫn hình/biểu đồ
// trong 1 lệnh gọi, không cần OCR riêng. Kết quả là 1 chuỗi text, đi thẳng vào chunkText rồi
// embedText phía sau.
export async function extractPdfContent(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_PDF_BYTES) {
    throw new Error(`File PDF quá lớn (${buffer.length} bytes) — vượt giới hạn ${MAX_PDF_BYTES} bytes cho inline PDF của Gemini.`);
  }

  const { systemPrompt } = await getActivePrompt("pdf_extraction");

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

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini không trích xuất được nội dung nào từ file PDF này.");
  }
  return text;
}
