// Measures the "quote verification" criterion (the one mentor asked about) for the extractActionItems
// tool: the isQuoteVerified/clampConfidence mechanism already exists in the code, this script is the
// first to MEASURE it with real numbers instead of just trusting it works.
// Creates 1 temporary document (bypassing the real upload pipeline, inserted straight into the DB),
// runs the tool, grades the result, then cleans up.
import { dbAdmin } from "../src/db/admin-client";
import { users, documents, chunks } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { extractActionItemsTool } from "../src/agents/tools/extract-action-items";

// 4 deliberately planted scenarios, each with a known correct answer beforehand — not meant to make
// the AI "look right by coincidence", but to check whether it correctly tells apart
// real/hypothetical/ambiguous the way the tool was designed to.
const FIXTURE_CONTENT = `BIÊN BẢN HỌP DỰ ÁN

Đội cần bàn giao module thanh toán trước ngày 30/10/2026.

Cuộc họp tổng kết dự án sẽ diễn ra lúc 14h00 ngày 15/11/2026.

Ví dụ, nếu deadline là 01/12/2026 thì team cần bắt đầu chuẩn bị từ đầu tháng.

Cần sớm hoàn thành phần kiểm thử, chưa có deadline cụ thể.`;

type Expectation = { matchText: string; expectVerified: boolean; expectConfidence: "confident" | "needs_review"; note: string };

const EXPECTATIONS: Expectation[] = [
  { matchText: "thanh toán", expectVerified: true, expectConfidence: "confident", note: "deadline thật, ngày rõ ràng" },
  { matchText: "tổng kết", expectVerified: true, expectConfidence: "confident", note: "deadline thật, có cả ngày lẫn giờ" },
  { matchText: "01/12", expectVerified: true, expectConfidence: "needs_review", note: "chỉ là VÍ DỤ minh hoạ, không phải cam kết thật" },
];

async function main() {
  const [testUser] = await dbAdmin.select({ id: users.id, email: users.email }).from(users).limit(1);
  if (!testUser) throw new Error("Không có user nào ở local để test.");

  const [testDoc] = await dbAdmin
    .insert(documents)
    .values({ userId: testUser.id, fileName: "_eval-fixture-quote-verification.txt", s3Key: "_eval/fixture.txt", status: "processed" })
    .returning({ id: documents.id });

  await dbAdmin.insert(chunks).values({ documentId: testDoc.id, content: FIXTURE_CONTENT, chunkIndex: 0 });

  console.log("Đã tạo tài liệu tạm, user:", testUser.email, "\n");

  try {
    const tool = extractActionItemsTool(testUser.id);
    // @ts-expect-error direct execute call for a smoke test, same pattern as other manual verifications this session
    const result = await tool.execute({ documentId: testDoc.id }, { toolCallId: "t1", messages: [] });

    if (!result.success) throw new Error(`Tool trả lỗi: ${result.error}`);
    console.log(`AI trích xuất được ${result.items.length} mục:\n`);
    for (const item of result.items) {
      console.log(`- "${item.title}" | dueAt=${item.dueAt} | confidence=${item.confidence} | verified=${item.verified}`);
      console.log(`  quote: "${item.sourceQuote}"\n`);
    }

    let correct = 0;
    const failures: string[] = [];
    for (const exp of EXPECTATIONS) {
      const matched = result.items.find((i) => i.sourceQuote.includes(exp.matchText) || i.title.includes(exp.matchText));
      if (!matched) {
        failures.push(`Không tìm thấy mục nào khớp "${exp.matchText}" (${exp.note}) — có thể AI đã bỏ sót.`);
        continue;
      }
      const verifiedOk = matched.verified === exp.expectVerified;
      const confidenceOk = matched.confidence === exp.expectConfidence;
      if (verifiedOk && confidenceOk) {
        correct++;
      } else {
        failures.push(
          `"${exp.matchText}" (${exp.note}): mong đợi verified=${exp.expectVerified}/confidence=${exp.expectConfidence}, ` +
            `thực tế verified=${matched.verified}/confidence=${matched.confidence}`
        );
      }
    }

    console.log(`\nĐộ chính xác quote-verification: ${correct}/${EXPECTATIONS.length}`);
    if (failures.length > 0) {
      console.log("\nCác case sai:");
      for (const f of failures) console.log(`  - ${f}`);
    }
  } finally {
    // Cleans up the temporary document, doesn't leave junk behind in the real user DB.
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
