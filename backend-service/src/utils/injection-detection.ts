// Quét injection bằng rule-based 1 lần lúc ingest, cố tình không dùng AI để quét vì rẻ và dự đoán được.
const SUSPICIOUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /ignore\s+(all|any|previous|the\s+above|prior)\s+(instructions?|prompts?|rules?)/i, reason: "Yêu cầu bỏ qua chỉ dẫn trước đó (tiếng Anh)" },
  { pattern: /disregard\s+(all|any|previous|the\s+above|prior)\s+(instructions?|prompts?|rules?)/i, reason: "Yêu cầu bỏ qua chỉ dẫn trước đó (tiếng Anh)" },
  { pattern: /bỏ\s*qua\s*(mọi|các|toàn\s*bộ)?\s*(chỉ\s*dẫn|hướng\s*dẫn|lệnh|yêu\s*cầu)\s*(trước\s*đó|ở\s*trên)?/i, reason: "Yêu cầu bỏ qua chỉ dẫn trước đó (tiếng Việt)" },
  { pattern: /you\s+are\s+now\s+(a|an)\s/i, reason: "Yêu cầu đóng vai/đổi vai trò hệ thống" },
  { pattern: /(từ\s*(giờ|bây\s*giờ|nay)\s*(trở\s*đi)?[,\s]*)(bạn|hãy)\s*là\s/i, reason: "Yêu cầu đóng vai/đổi vai trò hệ thống (tiếng Việt)" },
  { pattern: /system\s*prompt/i, reason: "Nhắc tới \"system prompt\" — dấu hiệu cố dò/ghi đè chỉ dẫn hệ thống" },
  { pattern: /reveal\s+(your\s+)?(system\s+)?(prompt|instructions)/i, reason: "Yêu cầu tiết lộ chỉ dẫn hệ thống" },
  { pattern: /tiết\s*lộ\s*(prompt|chỉ\s*dẫn|hướng\s*dẫn)\s*hệ\s*thống/i, reason: "Yêu cầu tiết lộ chỉ dẫn hệ thống (tiếng Việt)" },
  { pattern: /print\s+(your\s+)?system\s+prompt/i, reason: "Yêu cầu in ra chỉ dẫn hệ thống" },
];

export function detectPromptInjection(text: string): { flagged: boolean; reason: string | null } {
  for (const { pattern, reason } of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) return { flagged: true, reason };
  }
  return { flagged: false, reason: null };
}
