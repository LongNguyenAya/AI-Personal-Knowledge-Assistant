import { researchNode } from "../src/agents/orchestrator/research-node";

async function main() {
  // user_id của "test account 1" trên production, đã có 5 tài liệu thật
  const userId = "b1e0f1a4-b416-40d7-938f-ffea47d286b0";

  console.log("=== Câu hỏi LIÊN QUAN tới quy trình git ===");
  const r1 = await researchNode({ userId, message: "quy trình đặt tên nhánh trong git như thế nào?" });
  console.log(r1.researchResult);

  console.log("\n=== Câu hỏi KHÔNG liên quan gì tới tài liệu đã có ===");
  const r2 = await researchNode({ userId, message: "công thức tính diện tích hình cầu là gì?" });
  console.log(r2.researchResult);
}
main().catch((e) => { console.error(e); process.exit(1); });
