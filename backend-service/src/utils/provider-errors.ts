import { APICallError } from "ai";

// Không lộ chi tiết kỹ thuật (status code, message gốc từ Gemini) ra cho user — chỉ nói rõ nên
// làm gì tiếp theo.
export const PROVIDER_OVERLOADED_MESSAGE =
  "Hệ thống đang quá tải hoặc đã tạm hết hạn mức miễn phí — vui lòng thử lại sau vài phút.";

// isRetryable do chính AI SDK phân loại (dựa theo status code/loại lỗi thật từ provider) — đáng
// tin hơn tự đoán theo status code, vì SDK đã phân biệt sẵn "lỗi tạm thời của provider" (nên thử
// lại sau) với "lỗi do request sai" (thử lại lúc nào cũng lỗi y hệt, không phải vấn đề tạm thời).
// PHẢI dùng APICallError.isInstance() (kiểm tra qua Symbol nội bộ), KHÔNG dùng `instanceof` —
// @ai-sdk/google có bản @ai-sdk/provider riêng lồng trong node_modules của nó, khác class
// reference với bản import trực tiếp từ "ai" ở đây dù cùng tên, nên `instanceof` luôn false với
// lỗi thật ném ra từ bên trong provider (đã kiểm chứng bằng lỗi Gemini thật, không phải đoán).
export function isRetryableProviderError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.isRetryable === true;
}

// Dùng làm onError cho createUIMessageStream/toUIMessageStreamResponse — SDK tự bắt lỗi ném ra từ
// model call, gọi hàm này lấy CHUỖI hiển thị cho user thay vì lộ lỗi kỹ thuật gốc ra ngoài.
export function toUserFacingErrorMessage(error: unknown): string {
  if (isRetryableProviderError(error)) return PROVIDER_OVERLOADED_MESSAGE;
  console.error("[stream-error]", error);
  return "Đã có lỗi xảy ra, vui lòng thử lại.";
}
