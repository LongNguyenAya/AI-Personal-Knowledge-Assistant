import { tool } from "ai";
import { z } from "zod";
import type { DiagramToolOutput } from "@ai-assistant/shared-types";
import { validateMermaidSyntax } from "../../utils/validate-mermaid";

// Unlike createChart (which queries the DB itself), here the model writes the Mermaid code itself.
// This is the 1 spot in action-agent with a cheap, objective correctness check (parses or it doesn't)
// but no self-check loop before this — the tool now actually renders-checks before accepting the code,
// and hands back the parser's own error so the model can fix its own mistake and call the tool again,
// instead of forwarding broken Mermaid straight to the user.
export function createDiagramTool() {
  return tool({
    description:
      "Vẽ sơ đồ khối/luồng (flowchart) để minh hoạ 1 quy trình có NHIỀU BƯỚC hoặc NHIỀU NHÁNH RẼ " +
      "liên kết nhau (vd quy trình làm việc, các bước xử lý, luồng nhánh git...). CHỈ dùng khi nội " +
      "dung thật sự hợp để nhìn bằng hình — KHÔNG dùng cho câu trả lời chỉ cần vài dòng chữ là đủ, " +
      "và KHÔNG dùng cho số liệu/xu hướng (dùng createChart cho việc đó). Chỉ vẽ đúng những bước có " +
      "thật trong tài liệu/ngữ cảnh đã đọc được, KHÔNG bịa thêm bước nào không có. Nếu tool báo lỗi cú " +
      "pháp, đọc kỹ thông báo lỗi và gọi lại tool với mã Mermaid đã sửa, đừng bỏ cuộc sau 1 lần thử.",
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
      const validated = await validateMermaidSyntax(mermaidCode);
      if (!validated.valid) {
        return {
          success: false,
          error: `Mã Mermaid sai cú pháp, chưa được vẽ: ${validated.error}. Hãy sửa lại mã và gọi lại tool này.`,
        };
      }
      return { success: true, title, mermaidCode };
    },
  });
}
