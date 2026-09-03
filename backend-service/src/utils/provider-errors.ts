import { APICallError } from "ai";

// Không lộ chi tiết kỹ thuật ra cho user, chỉ nói rõ nên làm gì tiếp theo.
export const PROVIDER_OVERLOADED_MESSAGE =
  "Hệ thống đang quá tải hoặc đã tạm hết hạn mức miễn phí — vui lòng thử lại sau vài phút.";

// isRetryable do AI SDK tự phân loại, phải dùng APICallError.isInstance() vì instanceof luôn false ở @ai-sdk/google.
export function isRetryableProviderError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.isRetryable === true;
}

// Dùng làm onError cho stream response, lấy chuỗi hiển thị cho user thay vì lộ lỗi kỹ thuật gốc.
export function toUserFacingErrorMessage(error: unknown): string {
  if (isRetryableProviderError(error)) return PROVIDER_OVERLOADED_MESSAGE;
  console.error("[stream-error]", error);
  return "Đã có lỗi xảy ra, vui lòng thử lại.";
}
