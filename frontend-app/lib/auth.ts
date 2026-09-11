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
    expiresIn: 60 * 60 * 24, // 1 day (better-auth's default is 7 days)
    updateAge: 60 * 60 * 6, // auto-renews if there's been activity within the last 6 hours
  },
  emailAndPassword: {
    enabled: true,
    // Blocks right at /sign-in/email if the email isn't verified yet, this is built-in better-auth behavior.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.id, user.email, url);
    },
    // Revokes every old session once the password is reset, in case the password was leaked and someone else has a live session.
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.id, user.email, url);
    },
    // Sends the email automatically right after /sign-up/email, the client doesn't need to call a separate API.
    sendOnSignUp: true,
    // The app has no "resend" button yet so this flag is on to let better-auth send a fresh email every time someone tries to log in unverified.
    sendOnSignIn: true,
    // Clicking the verification link in the email creates a session right away, the default callbackURL "/" already matches app/page.tsx.
    autoSignInAfterVerification: true,
  },
  // Has to use dbAdmin since authentication isn't done yet so there's no current_user_id for RLS, the regular `db` would always wrongly report "user not found".
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = ctx.body?.email as string | undefined;
      if (!email) return;

      const [user] = await dbAdmin.select({ deletedAt: schema.users.deletedAt }).from(schema.users).where(eq(schema.users.email, email));
      if (user?.deletedAt) {
        throw new APIError("FORBIDDEN", { message: "This account has been deleted. Please contact an admin to restore it." });
      }
    }),
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // doesn't allow the user to set their own role at sign-up
      },
      isActive: {
        type: "boolean",
        defaultValue: true,
        input: false,
      },
      // Soft-delete used to only block a fresh login, deletedAt is put into session.user so routes can check it even for an existing session.
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
});