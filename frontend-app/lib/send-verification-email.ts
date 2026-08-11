import nodemailer from "nodemailer";

// Dùng chung tài khoản Gmail với backend-service/src/services/email.ts — 1 hòm thư demo cho cả
// 2 việc. auth.ts chạy trong tiến trình frontend-app nên cần transporter riêng ở đây, không
// gọi sang backend-service.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  await transporter.sendMail({
    from: `"AI Personal Knowledge Assistant" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Xác nhận tài khoản của bạn",
    text: `Chào bạn,\n\nVui lòng bấm vào đường dẫn sau để xác nhận tài khoản:\n${url}\n\nNếu bạn không tạo tài khoản này, hãy bỏ qua email này.`,
  });
}
