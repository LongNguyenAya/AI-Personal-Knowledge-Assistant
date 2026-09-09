import nodemailer from "nodemailer";

// Gmail SMTP via an App Password, free, no need to stand up a dedicated email service.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendReminderEmail(
  to: string,
  title: string,
  content: string | null,
  dueAt: Date,
  taskTitles: string[]
) {
  const dueAtVn = dueAt.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "full",
    timeStyle: "short",
  });

  const taskLine = taskTitles.length > 0 ? `Liên quan tới các task: ${taskTitles.join(", ")}\n\n` : "";

  await transporter.sendMail({
    from: `"AI Personal Knowledge Assistant" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Nhắc nhở: ${title}`,
    text: `${content ? content + "\n\n" : ""}${taskLine}Thời gian: ${dueAtVn}`,
  });
}

// frontend-app (on Render) calls over here to send email because Render blocks outbound SMTP, EC2 doesn't.
export async function sendVerificationEmail(to: string, url: string) {
  await transporter.sendMail({
    from: `"AI Personal Knowledge Assistant" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Xác nhận tài khoản của bạn",
    text: `Chào bạn,\n\nVui lòng bấm vào đường dẫn sau để xác nhận tài khoản:\n${url}\n\nNếu bạn không tạo tài khoản này, hãy bỏ qua email này.`,
  });
}

export async function sendResetPasswordEmail(to: string, url: string) {
  await transporter.sendMail({
    from: `"AI Personal Knowledge Assistant" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Đặt lại mật khẩu",
    text: `Chào bạn,\n\nVui lòng bấm vào đường dẫn sau để đặt lại mật khẩu (hết hạn sau 1 tiếng):\n${url}\n\nNếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
  });
}

// Sent alongside saving to DB, not a replacement, no link back to the app since backend-service doesn't have that URL on hand.
export async function sendWeeklyDigestEmail(
  to: string,
  weekStart: Date,
  weekEnd: Date,
  summaryText: string,
  stats: { documentsProcessed: number; tasksCompleted: number; tasksOverdue: number; conversationsStarted: number }
) {
  const fmt = (d: Date) => d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const statLines = [
    stats.documentsProcessed > 0 ? `- Tài liệu đã xử lý xong: ${stats.documentsProcessed}` : null,
    stats.tasksCompleted > 0 ? `- Task đã hoàn thành: ${stats.tasksCompleted}` : null,
    stats.tasksOverdue > 0 ? `- Task còn quá hạn: ${stats.tasksOverdue}` : null,
    stats.conversationsStarted > 0 ? `- Cuộc trò chuyện mới: ${stats.conversationsStarted}` : null,
  ].filter((l): l is string => l !== null);

  await transporter.sendMail({
    from: `"AI Personal Knowledge Assistant" <${process.env.GMAIL_USER}>`,
    to,
    subject: `Tóm tắt tuần của bạn (${fmt(weekStart)} - ${fmt(weekEnd)})`,
    text: `${summaryText}\n\n${statLines.join("\n")}\n\nXem lại đầy đủ trong mục "Tóm tắt tuần" của ứng dụng.`,
  });
}
