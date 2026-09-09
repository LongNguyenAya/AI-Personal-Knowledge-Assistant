import { log } from "../utils/log";
import { findDueReminders, markReminderSent, findRemindersNeedingEmail, markEmailSent } from "../db/repositories/reminders";
import { sendToUser } from "../ws/registry";
import { sendReminderEmail } from "../services/email";

// Scans via setInterval right inside the process, backend-service runs continuously so it's a good fit for self-timing.
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

        // Marked right after pushing even if no one has the app open, without a status change the scheduler would push it again every minute.
        await markReminderSent(reminder.id);
      } catch (err) {
        // A separate try/catch per reminder, without it 1 DB error would throw out of the for loop and skip the other reminders.
        log.error(`[scheduler] Lỗi khi xử lý reminder ${reminder.id}, sẽ thử lại lượt sau:`, err);
      }
    }
  } catch (err) {
    log.error("[scheduler] Lỗi khi quét reminder tới hạn:", err);
  }
}

// Scanned independently of checkDueReminders, relies on emailSentAt because status may already have changed via the WebSocket branch.
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
  // isRunning blocks 2 overlapping scan passes when 1 pass takes longer than POLL_INTERVAL_MS.
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
  tick(); // runs right at startup, catching up on reminders that came due while the service was down
  setInterval(tick, POLL_INTERVAL_MS);
  log.info(`[scheduler] Reminder scheduler đã khởi động, quét mỗi ${POLL_INTERVAL_MS / 1000}s.`);
}
