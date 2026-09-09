// Workers/schedulers run in the background outside any HTTP request, so console.log lacks a timestamp, wraps it to add local time.
function timestamp(): string {
  return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
}

export const log = {
  info: (...args: unknown[]) => console.log(`[${timestamp()}]`, ...args),
  warn: (...args: unknown[]) => console.warn(`[${timestamp()}]`, ...args),
  error: (...args: unknown[]) => console.error(`[${timestamp()}]`, ...args),
};
