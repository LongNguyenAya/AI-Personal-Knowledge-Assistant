import { tool } from "ai";
import { z } from "zod";
import type { DiagramToolOutput } from "@ai-assistant/shared-types";

// Khác createChart (tự query DB), ở đây model tự viết mã Mermaid, tool chỉ chuyển tiếp để vẽ.
export function createDiagramTool() {
  return tool({
    description:
      "Vẽ sơ đồ khối/luồng (flowchart) để minh hoạ 1 quy trình có NHIỀU BƯỚC hoặc NHIỀU NHÁNH RẼ " +
      "liên kết nhau (vd quy trình làm việc, các bước xử lý, luồng nhánh git...). CHỈ dùng khi nội " +
      "dung thật sự hợp để nhìn bằng hình — KHÔNG dùng cho câu trả lời chỉ cần vài dòng chữ là đủ, " +
      "và KHÔNG dùng cho số liệu/xu hướng (dùng createChart cho việc đó). Chỉ vẽ đúng những bước có " +
      "thật trong tài liệu/ngữ cảnh đã đọc được, KHÔNG bịa thêm bước nào không có.",
    inputSchema: z.object({
      title: z.string().describe("Tiêu đề ngắn gọn cho sơ đồ"),
      mermaidCode: z
        .string()
        .describe(
          "Mã Mermaid hợp lệ, dùng cú pháp 'flowchart TD' (từ trên xuống) hoặc 'flowchart LR' (trái sang phải). " +
            "Ví dụ: flowchart LR\\n  A[feature] --> B[develop]\\n  B --> C[main]"
        ),
    }),
    execute: async ({ title, mermaidCode }): Promise<DiagramToolOutput> => {
      return { success: true, title, mermaidCode };
    },
  });
}
