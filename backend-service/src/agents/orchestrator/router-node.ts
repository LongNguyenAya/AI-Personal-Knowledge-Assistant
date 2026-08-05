import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { OrchestratorState } from "./state";

const model = new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash", temperature: 0 });

export async function routerNode(state: typeof OrchestratorState.State) {
  const prompt = `Phân loại ý định của câu sau vào đúng 1 trong 4 nhãn: "research" (chỉ hỏi/tra cứu thông tin), "action" (chỉ muốn tạo task/reminder), "both" (vừa cần tra cứu vừa cần hành động), "unknown" (không rõ).
Chỉ trả lời đúng 1 từ trong 4 nhãn trên, không giải thích gì thêm.

Câu: "${state.message}"`;

  const result = await model.invoke(prompt);
  const label = result.content.toString().trim().toLowerCase();

  const validLabels = ["research", "action", "both", "unknown"];
  const route = validLabels.includes(label) ? label : "unknown";

  return { route };
}