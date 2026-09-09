import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getActivePrompt } from "../db/repositories/agent-prompts";
import { getSettingValue } from "../db/repositories/settings";

// A deliberately very low threshold, only meant to catch near-empty results, not a threshold for full detail.
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

// Sends the PDF straight to Gemini, the model reads each page like an image, understanding both text and figures in 1 call.
export async function extractPdfContent(buffer: Buffer): Promise<string> {
  // Admin adjusts this via /admin/settings, the real limit comes from Gemini's inline PDF request, capped at 15MB.
  const maxPdfBytes = (await getSettingValue("maxUploadMb")) * 1024 * 1024;
  if (buffer.length > maxPdfBytes) {
    throw new Error(`File PDF quá lớn (${buffer.length} bytes) — vượt giới hạn ${maxPdfBytes} bytes cho inline PDF của Gemini.`);
  }

  const { systemPrompt } = await getActivePrompt("pdf_extraction");

  let text = await callGemini(buffer, systemPrompt);
  // A near-empty result could just be 1 flaky run, retries exactly once before accepting it.
  if (text.trim().length < MIN_MEANINGFUL_LENGTH) {
    text = await callGemini(buffer, systemPrompt);
  }

  if (!text || text.trim().length === 0) {
    throw new Error("Gemini không trích xuất được nội dung nào từ file PDF này.");
  }
  return text;
}
