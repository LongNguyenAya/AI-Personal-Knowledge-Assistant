import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbAdmin } from "@/lib/db-admin";
import { sendVerificationEmail } from "@/lib/send-verification-email";
import { sendResetPasswordEmail } from "@/lib/send-reset-password-email";
import * as schema from "@ai-assistant/db/src/schema";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
    },
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24, // 1 ngày (mặc định của better-auth là 7 ngày)
    updateAge: 60 * 60 * 6, // tự gia hạn nếu còn hoạt động trong vòng 6 tiếng gần nhất
  },
  emailAndPassword: {
    enabled: true,
    // Chặn ngay tại /sign-in/email nếu chưa xác nhận email, đây là hành vi có sẵn của better-auth.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.id, user.email, url);
    },
    // Đặt lại mật khẩu xong thì huỷ hết session cũ, phòng trường hợp mật khẩu bị lộ và ai đó khác đang có session sống.
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.id, user.email, url);
    },
    // Tự gửi email ngay sau /sign-up/email, không cần client tự gọi thêm API riêng.
    sendOnSignUp: true,
    // App chưa có nút "gửi lại" nên bật cờ này để better-auth tự gửi email mới mỗi lần cố đăng nhập lúc chưa xác nhận.
    sendOnSignIn: true,
    // Bấm link xác nhận trong email xong là có session luôn, callbackURL mặc định "/" khớp sẵn với app/page.tsx.
    autoSignInAfterVerification: true,
  },
  // Phải dùng dbAdmin vì chưa xác thực xong nên chưa có current_user_id cho RLS, `db` thường sẽ luôn báo sai "không tìm thấy user".
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = ctx.body?.email as string | undefined;
      if (!email) return;

      const [user] = await dbAdmin.select({ deletedAt: schema.users.deletedAt }).from(schema.users).where(eq(schema.users.email, email));
      if (user?.deletedAt) {
        throw new APIError("FORBIDDEN", { message: "Tài khoản này đã bị xoá. Vui lòng liên hệ admin để khôi phục." });
      }
    }),
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // không cho phép user tự set role lúc đăng ký
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
      // Soft-delete trước đây chỉ chặn lúc đăng nhập mới, đưa deletedAt vào session.user để route tự check ngay cả session cũ.
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
});