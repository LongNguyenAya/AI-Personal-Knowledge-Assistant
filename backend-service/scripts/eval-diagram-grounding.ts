// Measures whether createDiagram's output actually reflects the real steps in a document, instead
// of only checking that the Mermaid syntax parses (already guaranteed by validateMermaidSyntax at
// runtime). Inserts a temporary document with a known, exact process (no upload pipeline involved,
// same pattern as eval-quote-verification.ts), lets the action agent read it and draw a diagram,
// then asks a separate model (Groq) to judge EVERY step drawn individually (grounded / unsupported
// / unclear), mirroring judgeActions/judgeContext in the mentor repo's scripts/eval-reports.ts
// rather than a single pass/fail for the whole diagram.
import { generateText, generateObject, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { dbAdmin } from "../src/db/admin-client";
import { users, documents, chunks } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { buildActionAgentSystemPrompt } from "../src/agents/prompts";
import { createDiagramTool } from "../src/agents/tools/create-diagram";
import { readFullDocumentsTool } from "../src/agents/tools/read-full-documents";
import { searchDocumentsTool } from "../src/agents/tools/search-documents";
import { writeEvalReport } from "./lib/eval-report";

// 4 real steps plus 1 rejection branch, deliberately specific so an invented extra step is easy
// to spot (e.g. an "IT department confirms" step or a second approval round that isn't here).
const FIXTURE_CONTENT = `Quy trình xử lý yêu cầu nghỉ phép:
1. Nhân viên gửi đơn nghỉ phép qua hệ thống nội bộ, ghi rõ ngày bắt đầu và ngày kết thúc.
2. Quản lý trực tiếp xem xét đơn trong vòng 2 ngày làm việc.
3. Nếu quản lý đồng ý, đơn được chuyển sang phòng nhân sự để kiểm tra số ngày phép còn lại.
4. Phòng nhân sự phê duyệt cuối cùng và gửi email xác nhận cho nhân viên.
Nếu quản lý từ chối ở bước 2, đơn bị huỷ ngay, không chuyển tiếp sang phòng nhân sự.`;

// Names the file directly (like a user quoting a filename they see in their document list) so
// the model resolves the documentId and calls readFullDocuments, instead of falling back to
// searchDocuments (semantic search), which the fixture chunk cannot match since it has no
// stored embedding, that dependency belongs to the real ingestion pipeline, not this eval.
const QUESTION = 'Đọc tài liệu "_eval-fixture-diagram-grounding.txt" và vẽ sơ đồ minh hoạ đúng quy trình được mô tả trong đó.';
const JUDGE_MODEL = "openai/gpt-oss-20b";

const StepVerdictSchema = z.object({
  label: z.string().describe("the exact node label/text from the diagram"),
  verdict: z.enum(["grounded", "unsupported", "unclear"]),
  reason: z.string(),
});
type StepVerdict = z.infer<typeof StepVerdictSchema>;

async function judgeDiagram(sourceText: string, mermaidCode: string): Promise<StepVerdict[]> {
  const { object } = await generateObject({
    model: groq(JUDGE_MODEL),
    schema: z.object({ steps: z.array(StepVerdictSchema) }),
    prompt:
      `A process diagram (Mermaid code) was drawn from the source document below. List EVERY node ` +
      `and every edge label in the diagram, and verdict each one separately:\n` +
      `- 'grounded': this exact step, actor, or condition is stated in the source text.\n` +
      `- 'unsupported': this step, actor, or condition is NOT stated in the source text at all, even if it sounds plausible for this kind of process.\n` +
      `- 'unclear': the source text implies something related but not specific enough to confirm this exact wording.\n` +
      `Do not flag wording differences (paraphrasing a real step is 'grounded'), only flag content with no basis in the source text.\n\n` +
      `SOURCE DOCUMENT:\n${sourceText}\n\nMERMAID DIAGRAM:\n${mermaidCode}`,
    telemetry: { functionId: "eval-diagram-grounding-judge" },
  });
  return object.steps;
}

async function main() {
  const [testUser] = await dbAdmin.select({ id: users.id, email: users.email }).from(users).where(eq(users.isActive, true)).limit(1);
  if (!testUser) throw new Error("Không có user active nào ở local để test.");

  const [testDoc] = await dbAdmin
    .insert(documents)
    .values({ userId: testUser.id, fileName: "_eval-fixture-diagram-grounding.txt", s3Key: "_eval/fixture-diagram.txt", status: "processed" })
    .returning({ id: documents.id });
  await dbAdmin.insert(chunks).values({ documentId: testDoc.id, content: FIXTURE_CONTENT, chunkIndex: 0 });

  console.log("Đã tạo tài liệu tạm, user:", testUser.email, "\n");

  try {
    const now = new Date();
    const result = await generateText({
      model: google("gemini-flash-lite-latest"),
      system: await buildActionAgentSystemPrompt(now.toISOString(), QUESTION, testUser.id),
      prompt: QUESTION,
      tools: {
        readFullDocuments: readFullDocumentsTool(testUser.id),
        searchDocuments: searchDocumentsTool(testUser.id),
        createDiagram: createDiagramTool(),
      },
      stopWhen: stepCountIs(5),
    });

    const diagramCall = result.toolResults.find((r) => r.type === "tool-result" && r.toolName === "createDiagram");
    if (!diagramCall) {
      const calledTools = result.toolResults.map((r) => r.toolName).join(", ") || "(none)";
      throw new Error(`Model không hề gọi createDiagram. Tool đã gọi: ${calledTools}. Câu trả lời cuối: ${result.text.slice(0, 300)}`);
    }
    const input = (diagramCall as { input: { title: string; mermaidCode: string } }).input;
    console.log(`Đã vẽ sơ đồ "${input.title}":\n${input.mermaidCode}\n`);

    const steps = await judgeDiagram(FIXTURE_CONTENT, input.mermaidCode);
    const s = steps.filter((v) => v.verdict === "grounded").length;
    const u = steps.filter((v) => v.verdict === "unclear").length;
    const x = steps.filter((v) => v.verdict === "unsupported").length;
    const allGrounded = x === 0;

    console.log(`Từng bước trong sơ đồ (${s}s/${u}?/${x}x):`);
    for (const v of steps) console.log(`  [${v.verdict}] "${v.label}", vì: ${v.reason}`);
    console.log(`\n${allGrounded ? "OK" : "SAI"}: không có bước nào bịa thêm = ${allGrounded}`);

    writeEvalReport("diagram-grounding", {
      title: "Diagram grounding",
      summary: `Bước trong sơ đồ: ${s} có căn cứ / ${u} chưa rõ / ${x} bịa thêm (tổng ${steps.length}). ${allGrounded ? "Không có bước nào bịa thêm." : "Có bước bịa thêm."}`,
      table: {
        headers: ["Bước trong sơ đồ", "Verdict", "Lý do"],
        rows: steps.map((v) => `| ${v.label} | ${v.verdict} | ${v.reason} |`),
      },
      notes: allGrounded ? [] : steps.filter((v) => v.verdict === "unsupported").map((v) => `"${v.label}": ${v.reason}`),
    });
  } finally {
    // Clean up the temporary document, doesn't leave junk behind in the real user DB.
    await dbAdmin.delete(chunks).where(eq(chunks.documentId, testDoc.id));
    await dbAdmin.delete(documents).where(eq(documents.id, testDoc.id));
    console.log("\nĐã dọn dẹp tài liệu tạm.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
