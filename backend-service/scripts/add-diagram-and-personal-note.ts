import { agentPrompts, users } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { dbAdmin } from "../src/db/admin-client";

// Chạy 1 lần — thêm hướng dẫn createDiagram + placeholder {{personalNote}} vào action prompt đang
// active, chèn vào 2 điểm neo cố định thay vì viết lại toàn bộ (tránh mất chỉnh sửa khác đã áp dụng).

const DIAGRAM_GUIDANCE = `Vẽ sơ đồ minh hoạ quy trình/luồng:
- Nếu user muốn MINH HOẠ 1 quy trình có nhiều bước hoặc nhiều nhánh rẽ liên kết nhau bằng HÌNH (vd
  "vẽ sơ đồ quy trình...", "minh hoạ luồng... bằng sơ đồ"), gọi tool createDiagram — KHÔNG dùng cho
  câu hỏi chỉ cần trả lời vài dòng chữ là đủ, và KHÔNG dùng cho số liệu/xu hướng (dùng createChart).
- Chỉ vẽ đúng các bước có thật trong tài liệu/ngữ cảnh đã đọc được (qua searchDocuments/
  readFullDocuments nếu cần), TUYỆT ĐỐI không bịa thêm bước nào không có.

`;

const PERSONAL_NOTE_SECTION = `Thông tin cá nhân do user tự cung cấp (nếu có, luôn tôn trọng khi đưa ra quyết định liên quan):
{{personalNote}}

`;

async function main() {
  const adminEmail = process.argv[2];
  if (!adminEmail) throw new Error("Cần truyền email admin, vd: tsx scripts/add-diagram-and-personal-note.ts admin@example.com");

  const [admin] = await dbAdmin.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (!admin) throw new Error(`Không tìm thấy user với email ${adminEmail}`);

  const [current] = await dbAdmin
    .select({ systemPrompt: agentPrompts.systemPrompt, version: agentPrompts.version })
    .from(agentPrompts)
    .where(and(eq(agentPrompts.agentType, "action"), eq(agentPrompts.isActive, true)));
  if (!current) throw new Error("Không tìm thấy action prompt đang active.");

  const DIAGRAM_ANCHOR = "Liên kết task và reminder:";
  const PERSONAL_NOTE_ANCHOR = "Ghi nhớ từ những lần bị sửa sai trước đó (nếu có):{{correctionContext}}";

  if (!current.systemPrompt.includes(DIAGRAM_ANCHOR)) {
    throw new Error(`Không tìm thấy điểm neo "${DIAGRAM_ANCHOR}" trong prompt đang active — prompt có thể đã đổi khác, cần tự kiểm tra lại.`);
  }
  if (!current.systemPrompt.includes(PERSONAL_NOTE_ANCHOR)) {
    throw new Error(`Không tìm thấy điểm neo "${PERSONAL_NOTE_ANCHOR}" trong prompt đang active — prompt có thể đã đổi khác, cần tự kiểm tra lại.`);
  }

  const newPrompt = current.systemPrompt
    .replace(DIAGRAM_ANCHOR, DIAGRAM_GUIDANCE + DIAGRAM_ANCHOR)
    .replace(PERSONAL_NOTE_ANCHOR, PERSONAL_NOTE_SECTION + PERSONAL_NOTE_ANCHOR);

  await dbAdmin.transaction(async (tx) => {
    await tx.update(agentPrompts).set({ isActive: false }).where(and(eq(agentPrompts.agentType, "action"), eq(agentPrompts.isActive, true)));
    await tx.insert(agentPrompts).values({
      agentType: "action",
      systemPrompt: newPrompt,
      updatedBy: admin.id,
      version: current.version + 1,
      isActive: true,
    });
  });

  console.log(`action: v${current.version} -> v${current.version + 1}`);
  console.log("Xong.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("LỖI:", err);
    process.exit(1);
  });
