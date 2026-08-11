import { findDueReminders, markReminderSent, findRemindersNeedingEmail, markEmailSent } from "../db/repositories/reminders";
import { sendToUser } from "../ws/registry";
import { sendReminderEmail } from "../services/email";

// Quét bằng setInterval ngay trong process Node đang chạy — không cần AWS EventBridge.
// backend-service vốn chạy liên tục (khác Next.js serverless) nên hợp để tự canh giờ chạy nền.
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

        // Đánh dấu ngay sau khi đẩy, kể cả khi không ai đang mở app để nhận (sendToUser lúc đó
        // chỉ im lặng bỏ qua). Không đổi status thì scheduler sẽ tìm thấy và đẩy lại reminder
        // này mỗi phút.
        await markReminderSent(reminder.id);
      } catch (err) {
        // try/catch riêng từng reminder, giống checkRemindersNeedingEmail bên dưới — thiếu nó,
        // 1 lỗi DB thoáng qua ở markReminderSent sẽ văng khỏi vòng for, bỏ lỡ các reminder khác
        // trong lượt và khiến reminder này bị đẩy WS lặp lại mỗi phút.
        console.error(`[scheduler] Lỗi khi xử lý reminder ${reminder.id}, sẽ thử lại lượt sau:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] Lỗi khi quét reminder tới hạn:", err);
  }
}

// Quét độc lập với checkDueReminders, dựa trên emailSentAt chứ không phải status (status có
// thể đã đổi thành "sent" từ nhánh WebSocket, không liên quan gì tới việc email đã gửi hay
// chưa). Mỗi email lỗi được bắt riêng để không chặn các reminder khác, và tự thử lại ở lượt
// sau vì markEmailSent chưa chạy.
async function checkRemindersNeedingEmail() {
  try {
    const due = await findRemindersNeedingEmail();
    for (const reminder of due) {
      try {
        await sendReminderEmail(reminder.userEmail, reminder.title, reminder.content, reminder.dueAt, reminder.taskTitles);
        await markEmailSent(reminder.id);
      } catch (err) {
        console.error(`[scheduler] Gửi email thất bại cho reminder ${reminder.id}, sẽ thử lại lượt sau:`, err);
      }
    }
  } catch (err) {
    console.error("[scheduler] Lỗi khi quét reminder cần gửi email:", err);
  }
}

export function startReminderScheduler() {
  // isRunning chặn 2 lượt quét chồng nhau — nếu 1 lượt chạy lâu hơn POLL_INTERVAL_MS (nhiều
  // reminder, DB chậm), setInterval vẫn gọi tick() tiếp mỗi 60s. Thiếu cờ này, lượt sau có thể
  // đẩy trùng reminder mà lượt trước chưa kịp đánh dấu xong.
  let isRunning = false;
  const tick = async () => {
    if (isRunning) {
      console.warn("[scheduler] Lượt quét trước chưa xong, bỏ qua lượt này.");
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
  console.log(`[scheduler] Reminder scheduler đã khởi động, quét mỗi ${POLL_INTERVAL_MS / 1000}s.`);
}
