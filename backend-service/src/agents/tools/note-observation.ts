import { tool } from "ai";
import { z } from "zod";
import { recordCorrectionMemory } from "../../db/repositories/correction-memories";
import { getSettingValue } from "../../db/repositories/settings";

// Khác correction do người sửa (có hiệu lực ngay), ở đây AI tự đề xuất nên luôn lưu status inactive.
export function noteObservationTool(userId: string) {
  return tool({
    description:
      "Ghi lại 1 quan sát/bài học khi bạn gặp tình huống MƠ HỒ hoặc khó xử lý trong lúc thực hiện " +
      "yêu cầu của user (vd định dạng ngày lạ, cách viết tắt khó đoán, quy ước riêng của user) — để " +
      "lần sau gặp tình huống tương tự xử lý tốt hơn. Đây CHỈ là đề xuất, user phải tự duyệt mới có " +
      "hiệu lực, không ảnh hưởng ngay. Chỉ dùng khi thực sự gặp điều gì đó bất thường đáng ghi nhớ — " +
      "KHÔNG dùng để ghi lại thông tin thông thường hay mỗi khi hoàn thành 1 việc bình thường.",
    inputSchema: z.object({
      sourceType: z.string().describe("Loại việc đang xử lý lúc gặp tình huống này, vd 'task', 'reminder'"),
      fieldName: z.string().describe("Trường dữ liệu liên quan tới tình huống mơ hồ, vd 'dueAt', 'title'"),
      observation: z.string().describe("Mô tả ngắn gọn quan sát/bài học — điều gì mơ hồ, bạn đã xử lý (hoặc nên xử lý) thế nào"),
    }),
    execute: async ({ sourceType, fieldName, observation }) => {
      // Admin tự chỉnh qua /admin/settings, mặc định thấp hơn correction do user sửa vì chưa ai xác nhận.
      const confidence = Math.round(await getSettingValue("aiNoteConfidence"));
      await recordCorrectionMemory({
        userId,
        sourceType,
        fieldName,
        correctedValue: observation,
        confidence,
        status: "inactive",
      });
      return { success: true as const, note: "Đã ghi lại, chờ user duyệt (trang Ghi chú AI) trước khi có hiệu lực." };
    },
  });
}
