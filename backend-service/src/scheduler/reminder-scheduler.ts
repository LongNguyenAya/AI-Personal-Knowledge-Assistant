import { log } from "../utils/log";
import { findDueReminders, markReminderSent, findRemindersNeedingEmail, markEmailSent } from "../db/repositories/reminders";
import { sendToUser } from "../ws/registry";
import { sendReminderEmail } from "../services/email";

// Quét bằng setInterval ngay trong process, backend-service chạy liên tục nên hợp để tự canh giờ.
const POLL_INTERVAL_MS = 60_000;

async function checkDueReminders() {
  try {
    const due = await findDueReminders();
    for (const reminder of due) {
      try {
        sendToUser(reminder.userId, {
          type: "reminder_due",
          reminderId: reminder.id,
          title: reminder.title,
          dueAt: reminder.dueAt.toISOString(),
          taskTitles: reminder.taskTitles,
        });

        // Đánh dấu ngay sau khi đẩy dù không ai mở app, không đổi status thì scheduler sẽ đẩy lại mỗi phút.
        await markReminderSent(reminder.id);
      } catch (err) {
        // try/catch riêng từng reminder, thiếu nó 1 lỗi DB sẽ văng khỏi vòng for và bỏ lỡ các reminder khác.
        log.error(`[scheduler] Lỗi khi xử lý reminder ${reminder.id}, sẽ thử lại lượt sau:`, err);
      }
    }
  } catch (err) {
    log.error("[scheduler] Lỗi khi quét reminder tới hạn:", err);
  }
}

// Quét độc lập với checkDueReminders, dựa trên emailSentAt vì status có thể đã đổi từ nhánh WebSocket.
async function checkRemindersNeedingEmail() {
  try {
    const due = await findRemindersNeedingEmail();
    for (const reminder of due) {
      try {
        await sendReminderEmail(reminder.userEmail, reminder.title, reminder.content, reminder.dueAt, reminder.taskTitles);
        await markEmailSent(reminder.id);
      } catch (err) {
        log.error(`[scheduler] Gửi email thất bại cho reminder ${reminder.id}, sẽ thử lại lượt sau:`, err);
      }
    }
  } catch (err) {
    log.error("[scheduler] Lỗi khi quét reminder cần gửi email:", err);
  }
}

export function startReminderScheduler() {
  // isRunning chặn 2 lượt quét chồng nhau khi 1 lượt chạy lâu hơn POLL_INTERVAL_MS.
  let isRunning = false;
  const tick = async () => {
    if (isRunning) {
      log.warn("[scheduler] Lượt quét trước chưa xong, bỏ qua lượt này.");
      return;
    }
    isRunning = true;
    try {
      await Promise.all([checkDueReminders(), checkRemindersNeedingEmail()]);
    } finally {
      isRunning = false;
    }
  };
  tick(); // chạy ngay lúc khởi động — bắt kịp reminder tới hạn trong lúc service tắt
  setInterval(tick, POLL_INTERVAL_MS);
  log.info(`[scheduler] Reminder scheduler đã khởi động, quét mỗi ${POLL_INTERVAL_MS / 1000}s.`);
}
