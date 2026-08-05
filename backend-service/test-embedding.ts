// test-embedding.ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function testEmbedding() {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: "Xin chào, đây là câu test embedding",
    config: { outputDimensionality: 768 },
  });
  console.log("Số chiều vector:", result.embeddings?.[0]?.values?.length);
}

testEmbedding();