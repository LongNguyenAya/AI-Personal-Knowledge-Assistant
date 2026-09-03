import { agentPrompts, users } from "@ai-assistant/db/src/schema";
import { and, eq } from "drizzle-orm";
import { dbAdmin } from "../src/db/admin-client";

// Chạy 1 lần — action prompt hiện tại chưa có placeholder {{correctionContext}} mà prompts.ts đã
// đọc/thay thế từ trước, nghĩa là correction hint tính ra rồi bị VỨT ĐI. Thêm vào cuối "Ghi nhớ kiến thức dài hạn".

async function main() {
  const adminEmail = process.argv[2];
  if (!adminEmail) throw new Error("Cần truyền email admin, vd: tsx scripts/add-correction-context-placeholder.ts admin@example.com");

  const [admin] = await dbAdmin.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (!admin) throw new Error(`Không tìm thấy user với email ${adminEmail}`);

  const [current] = await dbAdmin
    .select({ systemPrompt: agentPrompts.systemPrompt, version: agentPrompts.version })
    .from(agentPrompts)
    .where(and(eq(agentPrompts.agentType, "action"), eq(agentPrompts.isActive, true)));

  if (!current) throw new Error("Không tìm thấy action prompt đang active");
  if (current.systemPrompt.includes("{{correctionContext}}")) {
    console.log("Đã có {{correctionContext}} sẵn rồi, không cần sửa.");
    return;
  }

  const marker = "Danh sách tài liệu hiện có của user";
  if (!current.systemPrompt.includes(marker)) {
    throw new Error(`Không tìm thấy điểm chèn mong đợi ("${marker}") trong prompt hiện tại — kiểm tra lại thủ công.`);
  }

  const newPrompt = current.systemPrompt.replace(
    marker,
    `Ghi nhớ từ những lần bị sửa sai trước đó (nếu có):{{correctionContext}}\n${marker}`
  );

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

  console.log(`action prompt: v${current.version} -> v${current.version + 1}, đã thêm {{correctionContext}}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("LỖI:", err);
    process.exit(1);
  });
