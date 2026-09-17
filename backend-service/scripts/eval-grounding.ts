// Report-grading harness: runs N questions through the real research route (real retrieval + real
// submitAnswer, including the anti-fabrication verification step), and grades 2 objective things in
// code instead of trusting the model's own claim:
// 1. A question with real info in a document: does it cite the expected documentId.
// 2. A question with no relevant info at all: does the AI correctly decline (empty citedDocumentIds)
// instead of making up a source.
import { readFileSync } from "fs";
import { join } from "path";
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { retrieveRelevantChunks } from "../src/agents/retrieval";
import { buildResearchAgentSystemPrompt } from "../src/agents/prompts";
import { submitAnswerTool, extractGroundedAnswer, stopWhenAnswerAccepted } from "../src/agents/tools/submit-answer";
import { dbAdmin } from "../src/db/admin-client";
import { users } from "@ai-assistant/db/src/schema";
import { writeEvalReport } from "./lib/eval-report";

type EvalCase = { question: string; shouldFindInfo: boolean; expectedDocumentId?: string };

async function runResearch(userId: string, question: string) {
  const { context, contentsByDocumentId } = await retrieveRelevantChunks(question, userId, 15);
  const result = await generateText({
    model: google("gemini-flash-lite-latest"),
    system: await buildResearchAgentSystemPrompt(context),
    messages: [{ role: "user", content: question }],
    tools: { submitAnswer: submitAnswerTool(contentsByDocumentId) },
    toolChoice: { type: "tool", toolName: "submitAnswer" },
    stopWhen: [stepCountIs(3), stopWhenAnswerAccepted],
  });
  return extractGroundedAnswer(result.toolResults);
}

async function main() {
  const [testUser] = await dbAdmin.select({ id: users.id, email: users.email }).from(users).limit(1);
  if (!testUser) throw new Error("Không có user nào ở local để test.");
  console.log("Test với user:", testUser.email, "\n");

  const casesPath = join(__dirname, "../data/eval-grounding-cases.json");
  const cases: EvalCase[] = JSON.parse(readFileSync(casesPath, "utf-8"));

  let correct = 0;
  const failures: string[] = [];
  const rows: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (i > 0) await sleep(5000);

    try {
      const grounded = await runResearch(testUser.id, c.question);
      const citedIds = grounded?.citedDocumentIds ?? [];

      let pass: boolean;
      if (c.shouldFindInfo) {
        pass = citedIds.includes(c.expectedDocumentId!);
      } else {
        pass = citedIds.length === 0;
      }

      if (pass) correct++;
      else failures.push(`"${c.question}", mong đợi ${c.shouldFindInfo ? `trích dẫn ${c.expectedDocumentId}` : "KHÔNG trích dẫn gì"}, thực tế: [${citedIds.join(", ") || "rỗng"}]`);

      console.log(`${pass ? "OK" : "SAI"} [${c.shouldFindInfo ? "có info" : "không có info"}] "${c.question}"`);
      console.log(`   citedDocumentIds: [${citedIds.join(", ") || "rỗng"}]`);
      console.log(`   trả lời: ${(grounded?.answer ?? "(không có)").slice(0, 150)}...\n`);
      rows.push(`| ${c.question} | ${c.shouldFindInfo ? "có info" : "không có info"} | ${citedIds.join(", ") || "rỗng"} | ${pass ? "OK" : "SAI"} |`);
    } catch (err) {
      failures.push(`"${c.question}", LỖI: ${err instanceof Error ? err.message.slice(0, 100) : err}`);
      console.log(`LỖI "${c.question}"\n`);
      rows.push(`| ${c.question} | ${c.shouldFindInfo ? "có info" : "không có info"} | LỖI | SAI |`);
    }
  }

  const accuracy = ((correct / cases.length) * 100).toFixed(1);
  console.log(`\nĐộ chính xác grounding: ${correct}/${cases.length} (${accuracy}%)`);
  if (failures.length > 0) {
    console.log("\nCác case sai:");
    for (const f of failures) console.log(`  - ${f}`);
  }

  writeEvalReport("grounding", {
    title: "Research route grounding",
    summary: `Độ chính xác grounding: ${correct}/${cases.length} (${accuracy}%). 5 câu có đáp án thật (từ trace Langfuse) + 5 câu chắc chắn không có tài liệu liên quan, case cố định trong \`data/eval-grounding-cases.json\`.`,
    table: { headers: ["Câu hỏi", "Loại", "citedDocumentIds", "Kết quả"], rows },
    notes: failures,
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
