import { Annotation } from "@langchain/langgraph";

export const OrchestratorState = Annotation.Root({
  userId: Annotation<string>(),
  message: Annotation<string>(),
  route: Annotation<"research" | "action" | "both" | "unknown">(),
  researchResult: Annotation<string>({
    value: (_x: string, y: string) => y,
    default: () => "",
  }),
  actionResult: Annotation<string>({
    value: (_x: string, y: string) => y,
    default: () => "",
  }),
  finalResponse: Annotation<string>({
    value: (_x: string, y: string) => y,
    default: () => "",
  }),
});