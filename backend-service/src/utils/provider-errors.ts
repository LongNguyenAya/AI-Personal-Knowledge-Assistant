import { APICallError } from "ai";

// Doesn't expose technical details to the user, just states clearly what to do next.
export const PROVIDER_OVERLOADED_MESSAGE =
  "Hệ thống đang quá tải hoặc đã tạm hết hạn mức miễn phí, vui lòng thử lại sau vài phút.";

// isRetryable is classified by the AI SDK itself, has to use APICallError.isInstance() because instanceof is always false in @ai-sdk/google.
export function isRetryableProviderError(error: unknown): boolean {
  return APICallError.isInstance(error) && error.isRetryable === true;
}

// Used as onError for the stream response, returns a display string for the user instead of leaking the raw technical error.
export function toUserFacingErrorMessage(error: unknown): string {
  if (isRetryableProviderError(error)) return PROVIDER_OVERLOADED_MESSAGE;
  console.error("[stream-error]", error);
  return "Đã có lỗi xảy ra, vui lòng thử lại.";
}
