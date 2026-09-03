import { StateGraph, START, END } from "@langchain/langgraph";
import { OrchestratorState } from "./state";
import { routerNode } from "./router-node";
import { researchNode } from "./research-node";
import { actionNode } from "./action-node";

function routeDecision(state: typeof OrchestratorState.State) {
  if (state.route === "research") return "research";
  if (state.route === "action") return "action";
  if (state.route === "both") return "research"; // "both" -> research trước, rồi action
  return "action"; // "unknown" -> fallback, để action tự xử lý hoặc trả lời chung chung
}

// "both" cần chạy tiếp action sau khi research xong, các route khác kết thúc luôn.
function afterResearch(state: typeof OrchestratorState.State) {
  return state.route === "both" ? "action" : "finalize";
}

// Gộp kết quả cuối, ưu tiên actionResult vì đã bao gồm cả research nếu route both.
function finalizeNode(state: typeof OrchestratorState.State) {
  const finalResponse = state.actionResult || state.researchResult || "Xin lỗi, tôi chưa hiểu ý bạn.";
  return { finalResponse };
}

const graph = new StateGraph(OrchestratorState)
  .addNode("router", routerNode)
  .addNode("research", researchNode)
  .addNode("action", actionNode)
  .addNode("finalize", finalizeNode)
  .addEdge(START, "router")
  .addConditionalEdges("router", routeDecision, { research: "research", action: "action" })
  .addConditionalEdges("research", afterResearch, { action: "action", finalize: "finalize" })
  .addEdge("action", "finalize")
  .addEdge("finalize", END);

export const orchestratorGraph = graph.compile();

export async function runOrchestrator(message: string, userId: string) {
  const result = await orchestratorGraph.invoke({ userId, message });
  return result.finalResponse;
}