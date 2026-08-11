import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dbAdmin } from "@/lib/db-admin";
import { sendVerificationEmail } from "@/lib/send-verification-email";
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
    // Chặn ngay tại /sign-in/email nếu chưa xác nhận email — hành vi có sẵn của better-auth,
    // không cần tự viết check trong hooks.before.
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
    // Tự gửi email ngay sau /sign-up/email — không cần client tự gọi thêm API riêng.
    sendOnSignUp: true,
    // Link xác nhận hết hạn sau 1 tiếng, và việc gửi email cũng có thể lỗi — app chưa có nút
    // "gửi lại" nào. Bật cờ này thì mỗi lần user cố đăng nhập lúc chưa xác nhận, better-auth tự
    // gửi 1 email mới — coi như đường phục hồi duy nhất, đỡ phải xây riêng 1 trang/API cho việc đó.
    sendOnSignIn: true,
    // Bấm link xác nhận trong email xong là có session luôn, không cần đăng nhập lại lần nữa.
    // callbackURL mặc định "/" khớp sẵn với app/page.tsx.
    autoSignInAfterVerification: true,
  },
  // Chặn ngay ở bước sign-in, khác isActive (vẫn cho đăng nhập, chỉ chặn gọi API sau đó). Phải
  // dùng dbAdmin vì lúc này chưa xác thực xong, chưa có current_user_id cho RLS dựa vào — dùng
  // `db` thường thì RLS lọc sạch mọi dòng, check này sẽ luôn báo sai là "không tìm thấy user".
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
      // Soft-delete trước đây chỉ chặn được lúc đăng nhập mới (qua hooks.before ở trên) — user
      // có session sẵn (tự gia hạn mỗi 6h hoạt động) vẫn dùng app bình thường vô thời hạn. Đưa
      // deletedAt vào session.user để các route tự check ngay, không cần query DB riêng mỗi lần.
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
});