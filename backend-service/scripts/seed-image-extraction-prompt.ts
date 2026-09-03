import { agentPrompts, users } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { dbAdmin } from "../src/db/admin-client";

// Chạy 1 lần — tạo prompt đầu tiên cho agentType "image_extraction". Không theo cách deactivate-
// cũ-rồi-insert-mới của các script update-*-prompt khác vì đây là INSERT ĐẦU TIÊN, chưa có bản active nào.

const IMAGE_EXTRACTION_PROMPT = `Bạn đang đọc một bức ảnh (có thể là ảnh chụp trang tài liệu, ghi chú viết tay, bảng trắng, hoặc ảnh chụp màn hình). Hãy trích xuất TOÀN BỘ nội dung chữ/thông tin trong ảnh theo đúng thứ tự xuất hiện, dưới dạng văn bản thuần, theo các quy tắc sau:
- Với chữ viết tay: cố gắng đọc và chuyển thành text chính xác nhất có thể; nếu có đoạn không đọc được rõ, ghi chú "[không đọc được: mô tả ngắn vị trí]" thay vì bỏ qua im lặng hoặc đoán bừa nội dung.
- Với bảng biểu: chuyển thành text có cấu trúc rõ ràng (mỗi dòng 1 hàng, giữ tên cột).
- Với hình vẽ, biểu đồ, sơ đồ xuất hiện trong ảnh (không phải chữ viết): chèn 1 đoạn mô tả chi tiết ngay tại vị trí xuất hiện, bắt đầu bằng "[Hình ảnh: ...]", mô tả đầy đủ nội dung, số liệu, chữ trong hình, ý nghĩa — vì đây là phần AI sau này phải dựa vào để trả lời câu hỏi liên quan.
- Nếu ảnh bị mờ, nghiêng, hoặc chất lượng kém khiến không đọc được phần lớn nội dung, hãy nói rõ điều đó ở đầu kết quả thay vì cố đoán nội dung không có thật.
- Không thêm bình luận, nhận xét, hay lời dẫn của riêng bạn ngoài nội dung trích xuất.
- Trả về đúng 1 khối văn bản duy nhất.`;

async function main() {
  const adminEmail = process.argv[2];
  if (!adminEmail) throw new Error("Cần truyền email admin, vd: tsx scripts/seed-image-extraction-prompt.ts admin@example.com");

  const [admin] = await dbAdmin.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (!admin) throw new Error(`Không tìm thấy user với email ${adminEmail}`);

  await dbAdmin.insert(agentPrompts).values({
    agentType: "image_extraction",
    systemPrompt: IMAGE_EXTRACTION_PROMPT,
    updatedBy: admin.id,
    version: 1,
    isActive: true,
  });

  console.log("Đã tạo prompt image_extraction v1.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("LỖI:", err);
    process.exit(1);
  });
