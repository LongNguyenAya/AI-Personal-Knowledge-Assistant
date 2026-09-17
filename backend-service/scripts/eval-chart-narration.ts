// Measures whether the model's spoken summary after calling createChart actually matches the
// real JSON the tool returned, instead of just trusting the "PHAI tom tat lai bang loi" instruction
// in the action prompt. Uses a separate model (Groq) as a judge, same pattern as
// verifyContentMatch in submit-answer.ts, comparing the real structured result against the
// narration text. Runs against whatever real chart data the picked user already has, so the
// exact scenario (empty / trend / no-trend) each case lands in depends on live DB state.
//
// Grades per CLAIM, not per whole narration: the judge first splits the narration into its
// individual factual/interpretive claims, then verdicts each one as "consistent", "inconsistent",
// or "unclear" (a claim the chart data genuinely can't confirm or deny), mirroring judgeActions/
// judgeContext in the mentor repo's scripts/eval-reports.ts rather than a single pass/fail per case.
import { generateText, generateObject, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { createChartTool } from "../src/agents/tools/create-chart";
import { buildActionAgentSystemPrompt } from "../src/agents/prompts";
import { dbAdmin } from "../src/db/admin-client";
import { users } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import type { ChartToolOutput } from "@ai-assistant/shared-types";
import { writeEvalReport } from "./lib/eval-report";

const QUESTIONS = [
  "Biểu đồ số task hoàn thành theo tuần gần đây",
  "Thống kê số tài liệu tôi đã tải lên",
  "Tỷ lệ hoàn thành task theo trạng thái",
];

const JUDGE_MODEL = "openai/gpt-oss-20b";

const ClaimVerdictSchema = z.object({
  claim: z.string().describe("the specific claim from the narration, quoted or closely paraphrased"),
  verdict: z.enum(["consistent", "inconsistent", "unclear"]),
  reason: z.string(),
});
type ClaimVerdict = z.infer<typeof ClaimVerdictSchema>;

async function judgeNarration(chart: ChartToolOutput, narration: string): Promise<ClaimVerdict[]> {
  const { object } = await generateObject({
    model: groq(JUDGE_MODEL),
    schema: z.object({ claims: z.array(ClaimVerdictSchema) }),
    prompt:
      `First, split the narration below into its individual factual or interpretive claims about ` +
      `the chart (one claim per sentence or clause that asserts something checkable). Then verdict ` +
      `EACH claim separately against the real chart data, using these rules:\n` +
      `1. If "empty" is true and emptyReason is "no_data_ever", a claim is only consistent if it says the user has no data at all for this metric.\n` +
      `2. If "empty" is true and emptyReason is "no_recent_activity", a claim is only consistent if it says there IS older data, just none recently, "no data at all" is inconsistent here.\n` +
      `3. If "trend" is not null, a claim about direction is only consistent if it matches trend.slope's sign (positive = increasing, negative = decreasing).\n` +
      `4. If "xAxisType" is "time" AND "trend" is null AND empty is false, a claim asserting a confirmed/certain trend over time is inconsistent. A claim mentioning movingAverage as a tentative recent observation is consistent, but only if it does not overclaim certainty.\n` +
      `5. If "xAxisType" is "category" (a breakdown/distribution chart), there is no concept of a trend. A claim describing current proportions or which group is largest is consistent, do not mark it inconsistent for "lacking a trend".\n` +
      `6. A claim naming an outlier is only consistent if its label/value exactly matches an entry in the "outliers" array.\n` +
      `Use "unclear" only when the chart data genuinely does not contain enough information to confirm or deny the claim, never as a way to avoid choosing.\n\n` +
      `Real chart data (JSON):\n${JSON.stringify(chart)}\n\nNarration to check:\n${narration}`,
    telemetry: { functionId: "eval-chart-narration-judge" },
  });
  return object.claims;
}

async function main() {
  const [testUser] = await dbAdmin
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.isActive, true))
    .limit(1);
  if (!testUser) throw new Error("Không có user active nào ở local để test.");
  console.log("Test với user:", testUser.email, "\n");

  let casesWithNoInconsistency = 0;
  let claimsConsistent = 0;
  let claimsUnclear = 0;
  let claimsInconsistent = 0;
  const rows: string[] = [];
  const failures: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < QUESTIONS.length; i++) {
    const message = QUESTIONS[i];
    if (i > 0) await sleep(5000);

    const now = new Date();
    const result = await generateText({
      model: google("gemini-flash-lite-latest"),
      system: await buildActionAgentSystemPrompt(now.toISOString(), message, testUser.id),
      prompt: message,
      tools: { createChart: createChartTool(testUser.id) },
      stopWhen: stepCountIs(3),
    });

    const chartCall = result.toolResults.find((r) => r.type === "tool-result" && r.toolName === "createChart");
    if (!chartCall) {
      failures.push(`"${message}", model không hề gọi createChart.`);
      console.log(`SAI "${message}", không gọi tool.`);
      continue;
    }
    const chart = (chartCall as { output: ChartToolOutput }).output;
    const narration = result.text.trim();
    if (!narration) {
      failures.push(`"${message}", model không nói gì bằng lời sau khi gọi createChart.`);
      console.log(`SAI "${message}", không có narration.`);
      continue;
    }

    const claims = await judgeNarration(chart, narration);
    const s = claims.filter((c) => c.verdict === "consistent").length;
    const u = claims.filter((c) => c.verdict === "unclear").length;
    const x = claims.filter((c) => c.verdict === "inconsistent").length;
    claimsConsistent += s;
    claimsUnclear += u;
    claimsInconsistent += x;
    const caseOk = x === 0;
    if (caseOk) casesWithNoInconsistency++;

    rows.push(`| ${message} | ${s}s/${u}?/${x}x |`);
    console.log(`${caseOk ? "OK" : "SAI"} "${message}" (${s}s/${u}?/${x}x)`);
    console.log(`   empty=${chart.empty} emptyReason=${chart.emptyReason} trend=${chart.trend ? "co" : "null"} trendMessage=${chart.trendMessage ?? "null"}`);
    for (const c of claims) {
      if (c.verdict !== "consistent") console.log(`   [${c.verdict}] "${c.claim}", vì: ${c.reason}`);
    }
    if (!caseOk) {
      const badClaims = claims.filter((c) => c.verdict === "inconsistent").map((c) => `"${c.claim}" (${c.reason})`);
      failures.push(`"${message}", claim sai: ${badClaims.join("; ")}`);
    }
    console.log("");
  }

  const totalClaims = claimsConsistent + claimsUnclear + claimsInconsistent;
  console.log(`\nCase không có claim nào sai: ${casesWithNoInconsistency}/${QUESTIONS.length}`);
  console.log(`Claim: ${claimsConsistent} đúng / ${claimsUnclear} chưa rõ / ${claimsInconsistent} sai (tổng ${totalClaims})`);
  if (failures.length > 0) {
    console.log("\nCác case có claim sai:");
    for (const f of failures) console.log(`  - ${f}`);
  }

  writeEvalReport("chart-narration", {
    title: "Chart narration grounding",
    summary: `Case không có claim sai: ${casesWithNoInconsistency}/${QUESTIONS.length}. Claim: ${claimsConsistent} đúng / ${claimsUnclear} chưa rõ / ${claimsInconsistent} sai (tổng ${totalClaims}).`,
    table: { headers: ["Câu hỏi", "Claim (đúng/chưa rõ/sai)"], rows },
    notes: failures,
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
