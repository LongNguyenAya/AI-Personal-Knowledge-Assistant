import { log } from "../utils/log";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { findActiveUsers, hasDigestForWeek, gatherWeeklyStats, insertWeeklyDigest } from "../db/repositories/weekly-digests";
import { sendWeeklyDigestEmail } from "./email";

// Cắt theo ngày UTC, không theo giờ-phút, để weekStart ổn định làm khoá chống trùng (userId, weekStart).
function computeWeekRange(now = new Date()): { weekStart: Date; weekEnd: Date } {
  const weekEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  return { weekStart, weekEnd };
}

async function generateWeeklyDigestForUser(userId: string, email: string): Promise<void> {
  const { weekStart, weekEnd } = computeWeekRange();
  if (await hasDigestForWeek(userId, weekStart)) return;

  const stats = await gatherWeeklyStats(userId, weekStart, weekEnd);
  const totalActivity = stats.documentsProcessed + stats.tasksCompleted + stats.tasksOverdue + stats.conversationsStarted;
  // Không tạo digest cho tuần hoàn toàn không hoạt động, tránh dòng vô nghĩa lặp lại mỗi tuần.
  if (totalActivity === 0) return;

  const { text } = await generateText({
    model: google("gemini-flash-lite-latest"),
    prompt:
      `Viết 1 đoạn tóm tắt ngắn (3-5 câu, giọng thân thiện, tiếng Việt) về hoạt động của user trong ` +
      `1 tuần vừa qua trên ứng dụng AI Personal Knowledge Assistant. CHỈ dựa vào đúng số liệu bên ` +
      `dưới, không bịa thêm số liệu hay chi tiết nào khác. Số liệu nào bằng 0 thì bỏ qua, không cần ` +
      `nhắc tới. Nếu có task quá hạn, nhắc nhở nhẹ nhàng, không tạo cảm giác trách móc.\n\n` +
      `- Tài liệu đã xử lý xong: ${stats.documentsProcessed}\n` +
      `- Task đã hoàn thành: ${stats.tasksCompleted}\n` +
      `- Task còn quá hạn (chưa hoàn thành, đã tới hạn trong tuần): ${stats.tasksOverdue}\n` +
      `- Cuộc trò chuyện mới đã bắt đầu: ${stats.conversationsStarted}`,
    telemetry: { functionId: "weekly-digest" },
  });

  await insertWeeklyDigest({ userId, weekStart, weekEnd, summaryText: text, stats });

  // Gửi mail tách riêng try/catch, lỗi gửi mail không được làm mất digest đã lưu DB.
  try {
    await sendWeeklyDigestEmail(email, weekStart, weekEnd, text, stats);
  } catch (err) {
    log.error(`[weekly-digest] Gửi email tóm tắt tuần thất bại cho user ${userId}:`, err);
  }
}

// Gọi mỗi khi worker nhận trigger từ SQS, lặp qua tất cả user active, lỗi 1 user không chặn user khác.
export async function generateWeeklyDigests(): Promise<void> {
  const activeUsers = await findActiveUsers();
  for (const user of activeUsers) {
    try {
      await generateWeeklyDigestForUser(user.id, user.email);
    } catch (err) {
      log.error(`[weekly-digest] Lỗi khi tạo digest cho user ${user.id}:`, err);
    }
  }
}
