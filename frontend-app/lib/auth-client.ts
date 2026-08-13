import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth"; 

// Không set baseURL — hardcode (vd localhost:3000) sẽ khiến mọi request signIn/signUp/signOut/
// useSession từ trình duyệt cố gọi thẳng domain đó thay vì domain thật lúc deploy. Để trống,
// better-auth client tự dùng same-origin.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signUp, signOut, useSession } = authClient;