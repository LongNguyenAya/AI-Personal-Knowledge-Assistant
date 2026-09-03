// Đo ĐỘ CHÍNH XÁC THẬT của AI (khác unit test) — tự tạo câu hỏi từ dữ liệu thật đang có (không cố
// định), chạy qua routerNode/retrieveRelevantChunks thật, so kết quả với đáp án tự suy ra. Không
// chạy trong CI/npm test (tốn lệnh gọi Gemini thật) — tự chạy tay sau khi đổi prompt/model lớn.
//
// Chạy: npm run eval:router  (hoặc thêm --user=someone@example.com)

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { routerNode } from "../src/agents/orchestrator/router-node";
import { retrieveRelevantChunks } from "../src/agents/retrieval";
import { getDocumentChunks } from "../src/db/repositories/chunks";
import { dbAdmin } from "../src/db/admin-client";
import { users, documents } from "@ai-assistant/db/src/schema";
import { and, eq, isNull } from "drizzle-orm";

type Route = "research" | "action" | "both" | "unknown";

type Fixture = {
  question: string;
  expectedRoute: Route;
  // Chỉ áp dụng khi expectedRoute là "research"/"both" — tên file PHẢI xuất hiện trong danh sách
  // sources mà retrieveRelevantChunks tìm được (không nhất thiết #1, chỉ cần lọt vào top kết quả).
  expectedFileName?: string;
};

const MAX_DOCUMENT_FIXTURES = 5; // giới hạn số lệnh gọi Gemini để sinh câu hỏi, tránh chạy quá lâu/tốn

// Tham số hoá ngẫu nhiên mỗi lần chạy — không lặp lại y hệt giữa các lần, vẫn đủ để kiểm tra
// router có nhận đúng đây là "action" hay không, không cần dữ liệu tài liệu nào.
const RANDOM_HOURS = ["9h sáng", "14h chiều", "18h tối", "20h tối"];
const RANDOM_TASKS = ["dọn bàn làm việc", "gửi báo cáo tuần", "gọi điện cho khách hàng", "kiểm tra lại hợp đồng"];
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function resolveUser(): Promise<{ id: string; email: string }> {
  const emailArg = process.argv.find((a) => a.startsWith("--user="))?.split("=")[1];
  if (emailArg) {
    const [user] = await dbAdmin.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, emailArg));
    if (!user) throw new Error(`Không tìm thấy user ${emailArg} trong DB.`);
    return user;
  }

  // Không chỉ định --user — tự lấy user active bất kỳ ĐANG CÓ ít nhất 1 tài liệu processed, để
  // luôn sinh được ít nhất vài fixture research thay vì chọn nhầm user rỗng dữ liệu.
  const candidates = await dbAdmin
    .selectDistinct({ id: users.id, email: users.email })
    .from(users)
    .innerJoin(documents, eq(documents.userId, users.id))
    .where(and(eq(users.isActive, true), isNull(users.deletedAt), eq(documents.status, "processed")));

  if (candidates.length === 0) throw new Error("Không tìm thấy user nào đang có tài liệu processed để tạo fixture — upload thử ít nhất 1 tài liệu trước.");
  return pickRandom(candidates);
}

async function generateResearchFixture(userId: string, doc: { id: string; fileName: string }): Promise<Fixture | null> {
  const chunks = await getDocumentChunks(userId, doc.id);
  if (chunks.length === 0) return null;
  const fullText = chunks.map((c) => c.content).join("\n\n").slice(0, 4000);

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    prompt:
      `Đọc đoạn tài liệu bên dưới, đặt ra ĐÚNG 1 câu hỏi ngắn tự nhiên (giọng người dùng thật, tiếng ` +
      `Việt) mà câu trả lời BẮT BUỘC phải dựa vào chính nội dung này mới trả lời được. Chỉ trả về ` +
      `đúng câu hỏi, không giải thích, không đánh số, không có dấu ngoặc kép bao quanh.\n\n` +
      `Tài liệu:\n${fullText}`,
    telemetry: { functionId: "eval-generate-fixture" },
  });

  const question = text.trim().replace(/^"|"$/g, "");
  if (!question) return null;
  return { question, expectedRoute: "research", expectedFileName: doc.fileName };
}

async function buildFixtures(user: { id: string }): Promise<Fixture[]> {
  const processedDocs = await dbAdmin
    .select({ id: documents.id, fileName: documents.fileName })
    .from(documents)
    .where(and(eq(documents.userId, user.id), eq(documents.status, "processed")))
    .limit(MAX_DOCUMENT_FIXTURES);

  const researchFixtures: Fixture[] = [];
  for (const doc of processedDocs) {
    const fixture = await generateResearchFixture(user.id, doc);
    if (fixture) researchFixtures.push(fixture);
  }

  const actionFixtures: Fixture[] = [
    { question: `Tạo nhắc nhở họp lúc ${pickRandom(RANDOM_HOURS)} mai`, expectedRoute: "action" },
    { question: `Đánh dấu task '${pickRandom(RANDOM_TASKS)}' là đã xong`, expectedRoute: "action" },
    { question: "Vẽ biểu đồ số task hoàn thành theo tuần gần đây", expectedRoute: "action" },
  ];

  const bothFixtures: Fixture[] =
    processedDocs.length > 0
      ? [
          {
            question: `Xem tài liệu "${processedDocs[0].fileName}" và tạo nhắc nhở nếu có deadline nào sắp tới`,
            expectedRoute: "both",
            expectedFileName: processedDocs[0].fileName,
          },
        ]
      : [];

  return [...researchFixtures, ...actionFixtures, ...bothFixtures];
}

async function main() {
  const user = await resolveUser();
  console.log(`Sinh fixture cho user: ${user.email}\n`);

  const fixtures = await buildFixtures(user);
  if (fixtures.length === 0) throw new Error("Không sinh được fixture nào — user này chưa có tài liệu processed nào.");

  let routeCorrect = 0;
  let citationChecked = 0;
  let citationCorrect = 0;

  console.log(`Chạy ${fixtures.length} câu hỏi (tự sinh)...\n`);

  for (const fixture of fixtures) {
    const { route } = await routerNode({ message: fixture.question });
    const routeOk = route === fixture.expectedRoute;
    if (routeOk) routeCorrect++;

    let citationLine = "";
    if (fixture.expectedFileName && (fixture.expectedRoute === "research" || fixture.expectedRoute === "both")) {
      citationChecked++;
      const { sources } = await retrieveRelevantChunks(fixture.question, user.id, 15);
      const found = sources.some((s) => s.fileName === fixture.expectedFileName);
      if (found) citationCorrect++;
      citationLine = ` | trích đúng tài liệu: ${found ? "✓" : "✗ (mong đợi " + fixture.expectedFileName + ")"}`;
    }

    console.log(
      `[${routeOk ? "✓" : "✗"}] "${fixture.question}"\n` +
        `    route: ${route} (mong đợi ${fixture.expectedRoute})${citationLine}`
    );
  }

  const routeAccuracy = ((routeCorrect / fixtures.length) * 100).toFixed(1);
  const citationAccuracy = citationChecked > 0 ? ((citationCorrect / citationChecked) * 100).toFixed(1) : "N/A";

  console.log(`\n=== Kết quả ===`);
  console.log(`Route đúng: ${routeCorrect}/${fixtures.length} (${routeAccuracy}%)`);
  console.log(`Trích đúng tài liệu: ${citationCorrect}/${citationChecked} (${citationAccuracy}%)`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
