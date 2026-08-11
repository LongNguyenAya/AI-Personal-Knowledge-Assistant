import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth"; 

// Không set baseURL — trước đây hardcode localhost:3000, khi deploy sẽ khiến mọi request
// signIn/signUp/signOut/useSession từ trình duyệt cố gọi thẳng localhost của máy người dùng
// thay vì domain thật. Để trống, better-auth client tự dùng same-origin.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;