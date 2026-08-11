import nodemailer from "nodemailer";

// Gmail SMTP qua App Password — miễn phí, không cần dịch vụ email riêng, hợp với demo không tốn phí.
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
