import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function embedText(text: string): Promise<number[]> {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });

  const values = result.embeddings?.[0]?.values;
  if (!values) throw new Error("Không lấy được embedding từ Gemini");

  return normalizeVector(values);
}

// Normalizes the vector, required when outputDimensionality is anything other than the default 3072
function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
}