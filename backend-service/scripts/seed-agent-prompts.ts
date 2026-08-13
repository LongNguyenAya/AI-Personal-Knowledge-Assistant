import { agentPrompts, users } from "@ai-assistant/db/src/schema";
import { eq } from "drizzle-orm";
import { dbAdmin } from "../src/db/admin-client";

// Chạy 1 lần — đưa 4 prompt đang hardcode vào bảng agent_prompts, làm nguồn thật từ giờ trở đi.
// Không ghi admin_audit_log vì đây là migration dữ liệu, không phải thao tác qua UI admin.
//
// Thiếu PDF_EXTRACTION_TEMPLATE ở đây từng khiến mọi lần upload PDF trên môi trường DB mới
// (Neon) báo "failed" ngay lập tức — pdf-extraction.ts gọi getActivePrompt("pdf_extraction"),
// không tìm thấy row nào thì throw, rơi xuống catch chung của processDocumentIngestion.

const RESEARCH_TEMPLATE = `Bạn là trợ lý nghiên cứu tài liệu. Chỉ trả lời dựa trên context được cung cấp dưới đây. Nếu context không đủ thông tin để trả lời, hãy nói rõ là không tìm thấy thông tin liên quan, không tự bịa.

Context:
{{context}}`;

const ACTION_TEMPLATE = `Bạn là trợ lý hành động. Nhiệm vụ của bạn là hiểu ý định của user và gọi đúng tool cần thiết.
- Nếu user muốn tạo reminder/nhắc nhở, gọi tool createReminder.
- Nếu user muốn tạo task/công việc cần làm, gọi tool createTask.
- Nếu user muốn xem danh sách task hiện có, gọi tool listTasks.
- Nếu user cần tra cứu thông tin trong tài liệu trước khi hành động, gọi tool searchDocuments trước.
- Sau khi gọi tool xong, trả lời user bằng ngôn ngữ tự nhiên xác nhận đã làm gì.

Bây giờ là {{currentDateUtc}} theo giờ UTC, tức {{currentDateVn}} theo giờ Việt Nam (UTC+7).
Người dùng đang ở múi giờ Việt Nam. Khi user nói thời gian theo kiểu địa phương (vd "8 giờ tối nay",
"ngày mai", "3 tiếng nữa"), hãy hiểu đó là giờ Việt Nam, tự quy đổi sang giờ UTC tương ứng (trừ đi 7
tiếng), rồi mới truyền tham số dueAt cho tool createReminder dưới dạng ISO 8601 có hậu tố "Z".`;

const ORCHESTRATOR_TEMPLATE = `Phân loại ý định của câu sau vào đúng 1 trong 4 nhãn: "research" (chỉ hỏi/tra cứu thông tin), "action" (chỉ muốn tạo task/reminder), "both" (vừa cần tra cứu vừa cần hành động), "unknown" (không rõ).
Chỉ trả lời đúng 1 từ trong 4 nhãn trên, không giải thích gì thêm.

Câu: "{{message}}"`;

const PDF_EXTRACTION_TEMPLATE = `Bạn đang đọc một file PDF. Hãy trích xuất TOÀN BỘ nội dung của file theo đúng thứ tự xuất hiện, dưới dạng văn bản thuần, theo các quy tắc sau:
- Với đoạn text: giữ nguyên nội dung, không tóm tắt, không bỏ sót.
- Với bảng biểu: chuyển thành text có cấu trúc rõ ràng (mỗi dòng 1 hàng, giữ tên cột).
- Với hình ảnh, biểu đồ, sơ đồ nhúng trong PDF: chèn 1 đoạn mô tả chi tiết ngay tại vị trí xuất hiện, bắt đầu bằng "[Hình ảnh: ...]", mô tả đầy đủ nội dung, số liệu, chữ trong hình, ý nghĩa của biểu đồ — vì đây là phần AI sau này phải dựa vào để trả lời câu hỏi liên quan đến hình ảnh.
- Không thêm bình luận, nhận xét, hay lời dẫn của riêng bạn ngoài nội dung trích xuất.
- Trả về đúng 1 khối văn bản duy nhất.`;

async function main() {
  const adminEmail = process.argv[2];
  if (!adminEmail) {
    throw new Error("Cần truyền email admin làm updatedBy, vd: tsx scripts/seed-agent-prompts.ts admin@example.com");
  }

  const [admin] = await dbAdmin.select({ id: users.id }).from(users).where(eq(users.email, adminEmail));
  if (!admin) throw new Error(`Không tìm thấy user với email ${adminEmail}`);

  const rows = [
    { agentType: "research" as const, systemPrompt: RESEARCH_TEMPLATE },
    { agentType: "action" as const, systemPrompt: ACTION_TEMPLATE },
    { agentType: "orchestrator" as const, systemPrompt: ORCHESTRATOR_TEMPLATE },
    { agentType: "pdf_extraction" as const, systemPrompt: PDF_EXTRACTION_TEMPLATE },
  ];

  for (const row of rows) {
    await dbAdmin.insert(agentPrompts).values({
      ...row,
      version: 1,
      isActive: true,
      updatedBy: admin.id,
    });
    console.log(`Seeded agentType=${row.agentType}`);
  }

  process.exit(0);
}

main();
