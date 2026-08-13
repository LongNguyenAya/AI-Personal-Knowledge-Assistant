import nodemailer from "nodemailer";

// Gmail SMTP qua App Password — miễn phí, không cần dựng dịch vụ email riêng.
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

// frontend-app (chạy trên Render) gọi sang đây để gửi email xác nhận đăng ký — Render chặn kết
// nối SMTP ra ngoài để chống spam, còn EC2 thì không (AWS chỉ chặn cổng 25 mặc định, không chặn
// cổng Gmail SMTP dùng), nên việc gửi email thật luôn nằm ở backend-service.
export async function sendVerificationEmail(to: string, url: string) {
  await transporter.sendMail({
    from: `"AI Personal Knowledge Assistant" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Xác nhận tài khoản của bạn",
    text: `Chào bạn,\n\nVui lòng bấm vào đường dẫn sau để xác nhận tài khoản:\n${url}\n\nNếu bạn không tạo tài khoản này, hãy bỏ qua email này.`,
  });
}
