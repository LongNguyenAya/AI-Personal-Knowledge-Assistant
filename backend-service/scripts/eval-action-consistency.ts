// Measures the "action consistency" criterion (the one mentor asked about): checks whether
// createReminder converts Vietnam time to UTC CORRECTLY when the user says a relative time.
// This is a SILENT class of bug: a wrong conversion never throws, it just sets the reminder at the
// wrong time — without an eval, almost nobody would ever notice.
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { createReminderTool } from "../src/agents/tools/create-reminder";
import { buildActionAgentSystemPrompt } from "../src/agents/prompts";
import { dbAdmin } from "../src/db/admin-client";
import { users, reminders } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";

// Vietnam has no DST, always UTC+7 year-round, so adding/subtracting 7 hours is safe for any date.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// Builds the exact UTC instant for "Vietnam time tomorrow at HH:mm" — used as the expected answer to compare against.
function vnTomorrowAt(now: Date, hour: number, minute: number): Date {
  const nowVn = new Date(now.getTime() + VN_OFFSET_MS);
  const tomorrowVnLabeled = new Date(Date.UTC(nowVn.getUTCFullYear(), nowVn.getUTCMonth(), nowVn.getUTCDate() + 1, hour, minute, 0));
  return new Date(tomorrowVnLabeled.getTime() - VN_OFFSET_MS);
}

function vnTodayAt(now: Date, hour: number, minute: number): Date {
  const nowVn = new Date(now.getTime() + VN_OFFSET_MS);
  const todayVnLabeled = new Date(Date.UTC(nowVn.getUTCFullYear(), nowVn.getUTCMonth(), nowVn.getUTCDate(), hour, minute, 0));
  return new Date(todayVnLabeled.getTime() - VN_OFFSET_MS);
}

type EvalCase = { message: string; expected: (now: Date) => Date; note: string };

const CASES: EvalCase[] = [
  { message: "nhắc tôi 9h sáng mai kiểm tra email", expected: (now) => vnTomorrowAt(now, 9, 0), note: "giờ mai, không qua nửa đêm UTC" },
  { message: "nhắc tôi lúc 23h tối nay hoàn thành báo cáo", expected: (now) => vnTodayAt(now, 23, 0), note: "giờ hôm nay, muộn" },
  { message: "nhắc tôi lúc 2h sáng mai đi lấy hàng", expected: (now) => vnTomorrowAt(now, 2, 0), note: "giờ mai nhưng rất sớm — dễ tính nhầm ngày UTC" },
];

async function main() {
  const [testUser] = await dbAdmin.select({ id: users.id, email: users.email }).from(users).limit(1);
  if (!testUser) throw new Error("Không có user nào ở local để test.");
  console.log("Test với user:", testUser.email, "\n");

  let correct = 0;
  const failures: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    if (i > 0) await sleep(5000);

    const now = new Date();
    const expectedUtc = c.expected(now);

    const result = await generateText({
      model: google("gemini-flash-lite-latest"),
      system: await buildActionAgentSystemPrompt(now.toISOString(), c.message, testUser.id),
      prompt: c.message,
      tools: { createReminder: createReminderTool(testUser.id) },
      stopWhen: stepCountIs(3),
    });

    const reminderCall = result.toolResults.find((r) => r.type === "tool-result" && r.toolName === "createReminder");
    if (!reminderCall) {
      failures.push(`"${c.message}" — model không hề gọi createReminder.`);
      console.log(`SAI [${c.note}] "${c.message}" — không gọi tool.`);
      continue;
    }

    const input = (reminderCall as { input: { dueAt: string } }).input;
    const actualUtc = new Date(input.dueAt);
    // Allows up to 60s of drift, enough slack for the model/eval not calling new Date() at the exact same millisecond.
    const diffMs = Math.abs(actualUtc.getTime() - expectedUtc.getTime());
    const pass = diffMs <= 60_000;

    if (pass) correct++;
    else failures.push(`"${c.message}" — mong đợi ${expectedUtc.toISOString()}, thực tế ${actualUtc.toISOString()} (lệch ${Math.round(diffMs / 60000)} phút)`);

    console.log(`${pass ? "OK" : "SAI"} [${c.note}] "${c.message}"`);
    console.log(`   mong đợi: ${expectedUtc.toISOString()} | thực tế: ${actualUtc.toISOString()}\n`);

    // Deletes the reminder just created right away, this is only an eval, not a real user reminder.
    const output = (reminderCall as { output: { reminderId?: string } }).output;
    if (output.reminderId) {
      await dbAdmin.delete(reminders).where(eq(reminders.id, output.reminderId));
    }
  }

  console.log(`\nĐộ chính xác quy đổi giờ: ${correct}/${CASES.length}`);
  if (failures.length > 0) {
    console.log("\nCác case sai:");
    for (const f of failures) console.log(`  - ${f}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
