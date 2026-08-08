import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({ model: "gemini-flash-latest", temperature: 0 });

// Chỉ cần state.message — khai báo kiểu hẹp thay vì toàn bộ OrchestratorState.State để
// có thể gọi hàm này độc lập (ngoài graph, không qua .invoke()) trong route streaming.
export async function routerNode(state: { message: string }) {
  const prompt = `Phân loại ý định của câu sau vào đúng 1 trong 4 nhãn: "research" (chỉ hỏi/tra cứu thông tin), "action" (chỉ muốn tạo task/reminder), "both" (vừa cần tra cứu vừa cần hành động), "unknown" (không rõ).
Chỉ trả lời đúng 1 từ trong 4 nhãn trên, không giải thích gì thêm.

Câu: "${state.message}"`;

  const result = await model.invoke(prompt);
  const label = result.content.toString().trim().toLowerCase();

  const validLabels = ["research", "action", "both", "unknown"];
  const route = validLabels.includes(label) ? label : "unknown";

  return { route };
}