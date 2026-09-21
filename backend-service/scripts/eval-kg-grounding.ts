// Measures the knowledge graph feature's core risk, decided instead of a live-blocking gate (see
// conversation notes): does queryKnowledgeGraph find a real cross-document connection when one
// exists, and does it correctly refuse to connect 2 entities that only share a generic/common
// mention (the "ban tru"/"truong" trap already validated with throwaway scripts before this feature
// was built). Runs the REAL ingestion pipeline (extractAndStoreKnowledgeGraph, real Gemini calls),
// not a hand-built graph, so this also measures the real extraction step's reliability over time,
// same reasoning as eval-action-consistency.ts documenting the model's own non-determinism rather
// than hiding it. Correctness here is code-checked against a known ground truth, not an LLM judge,
// since "did it find the expected connection" has an objective right answer once the fixture is fixed.
import { dbAdmin } from "../src/db/admin-client";
import { users, documents, chunks, kgEntities, kgRelations } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { extractAndStoreKnowledgeGraph } from "../src/services/knowledge-graph-extraction";
import { queryKnowledgeGraphTool } from "../src/agents/tools/query-knowledge-graph";
import { writeEvalReport } from "./lib/eval-report";

// Real case: A and C never appear in the same document, only connected through Omega mentioned in both.
const REAL_CASE_DOCS = [
  { fileName: "_eval-fixture-kg-real-1.txt", content: "Nguyễn Văn A phụ trách dự án Omega, chịu trách nhiệm về tiến độ chung." },
  { fileName: "_eval-fixture-kg-real-2.txt", content: "Trần Thị C hiện đang làm quản lý cho dự án Omega, thay thế người tiền nhiệm." },
];

// Trap case: Minh and Lan are unrelated, only sharing a mention of the generic word "truong"/"ban tru".
const TRAP_CASE_DOCS = [
  { fileName: "_eval-fixture-kg-trap-1.txt", content: "Học sinh Minh ăn cơm bán trú tại trường." },
  { fileName: "_eval-fixture-kg-trap-2.txt", content: "Ở trường mà học sinh Lan theo học, bán trú được đăng ký trước tháng 8." },
];

async function main() {
  const [testUser] = await dbAdmin.select({ id: users.id, email: users.email }).from(users).limit(1);
  if (!testUser) throw new Error("Không có user nào ở local để test.");

  const insertedDocIds: string[] = [];
  async function ingestFixture(fileName: string, content: string) {
    const [doc] = await dbAdmin
      .insert(documents)
      .values({ userId: testUser.id, fileName, s3Key: `_eval/${fileName}`, status: "processed" })
      .returning({ id: documents.id });
    insertedDocIds.push(doc.id);
    const [chunk] = await dbAdmin.insert(chunks).values({ documentId: doc.id, content, chunkIndex: 0 }).returning({ id: chunks.id });
    await extractAndStoreKnowledgeGraph(testUser.id, chunk.id, content);
  }

  console.log("Đã tạo tài liệu tạm, user:", testUser.email, "\n");

  try {
    for (const doc of REAL_CASE_DOCS) await ingestFixture(doc.fileName, doc.content);
    for (const doc of TRAP_CASE_DOCS) await ingestFixture(doc.fileName, doc.content);

    const tool = queryKnowledgeGraphTool(testUser.id);
    // @ts-expect-error direct execute call for a smoke test, same pattern as other manual verifications this session
    const realResult = await tool.execute({ entityA: "Nguyễn Văn A", entityB: "Trần Thị C" }, { toolCallId: "t1", messages: [] });
    // @ts-expect-error same as above
    const trapResult = await tool.execute({ entityA: "Minh", entityB: "Lan" }, { toolCallId: "t2", messages: [] });

    console.log("Case thật (Nguyễn Văn A <-> Trần Thị C):", JSON.stringify(realResult, null, 2));
    console.log("\nCase bẫy (Minh <-> Lan):", JSON.stringify(trapResult, null, 2));

    const realOk = realResult.found === true && Array.isArray(realResult.path) && realResult.path.length === 2;
    const trapOk = trapResult.found === false;

    // Distinguishes "correctly blocked because tagged concept" from "trivially passed because the
    // generic word was never extracted as an entity at all" (both give found=false, only 1 of them
    // is the safeguard actually working), same honesty this session has applied throughout.
    const truongEntities = await dbAdmin.select().from(kgEntities).where(eq(kgEntities.userId, testUser.id));
    const truongEntity = truongEntities.find((e) => e.name.toLowerCase().includes("trường"));
    const trapReason = truongEntity
      ? `Đã trích xuất "${truongEntity.name}" với kind=${truongEntity.entityKind}, kindDisagreement=${truongEntity.kindDisagreement} (chặn đúng vì safeguard hoạt động).`
      : `"trường" không được trích xuất thành entity nào cả lần chạy này (found=false xảy ra một cách tình cờ, không chứng minh được safeguard đã hoạt động).`;

    console.log(`\nCase thật đúng (tìm ra đường nối 2 bước): ${realOk ? "OK" : "SAI"}`);
    console.log(`Case bẫy đúng (không tìm ra kết nối giả): ${trapOk ? "OK" : "SAI"}`);
    console.log(`Lý do case bẫy: ${trapReason}`);

    const correct = (realOk ? 1 : 0) + (trapOk ? 1 : 0);
    const notes: string[] = [];
    if (!realOk) notes.push(`Case thật: mong đợi found=true với path 2 bước, thực tế: ${JSON.stringify(realResult)}`);
    notes.push(`Case bẫy: ${trapReason}`);

    writeEvalReport("kg-grounding", {
      title: "Knowledge graph query grounding",
      summary:
        `Độ chính xác: ${correct}/2. Chạy qua đúng pipeline trích xuất thật (Gemini), không dựng graph tay. ` +
        `1 case thật (2 tài liệu không nhắc trực tiếp nhau, chỉ nối qua 1 dự án chung) + 1 case bẫy ` +
        `(2 tài liệu chỉ chia sẻ 1 khái niệm chung chung "trường"/"bán trú", không thực sự liên quan).`,
      table: {
        headers: ["Case", "Mong đợi", "Thực tế", "Kết quả"],
        rows: [
          `| Nguyễn Văn A <-> Trần Thị C (qua dự án Omega) | found=true, path 2 bước | found=${realResult.found}, path ${(realResult as any).path?.length ?? 0} bước | ${realOk ? "OK" : "SAI"} |`,
          `| Minh <-> Lan (chỉ chung "trường") | found=false | found=${trapResult.found} | ${trapOk ? "OK" : "SAI"} |`,
        ],
      },
      notes,
    });
  } finally {
    for (const docId of insertedDocIds) {
      await dbAdmin.delete(chunks).where(eq(chunks.documentId, docId));
      await dbAdmin.delete(documents).where(eq(documents.id, docId));
    }
    await dbAdmin.delete(kgRelations).where(eq(kgRelations.userId, testUser.id));
    await dbAdmin.delete(kgEntities).where(eq(kgEntities.userId, testUser.id));
    console.log("\nĐã dọn dẹp tài liệu tạm.");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("LỖI:", err);
  process.exit(1);
});
