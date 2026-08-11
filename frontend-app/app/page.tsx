import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

// Domain gốc redirect theo session: chưa đăng nhập thì về /login, admin về dashboard, user
// thường về /chat. Làm ở server component nên không có khoảng trắng/flash nào hiện ra.
//
// better-auth cũng đưa user về đây (callbackURL mặc định "/") sau khi bấm link xác nhận email,
// kể cả khi verify lỗi (token hết hạn/không hợp lệ) — kèm ?error=... thay vì báo lỗi trực tiếp.
// Chuyển tiếp lỗi này sang /login để hiện thông báo, vì login page có sendOnSignIn nên user thử
// đăng nhập lại sẽ tự được gửi email xác nhận mới.
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect(error ? `/login?error=${encodeURIComponent(error)}` : "/login");
  if (session.user.role === "admin") redirect("/admin/dashboard");
  redirect("/chat");
}
