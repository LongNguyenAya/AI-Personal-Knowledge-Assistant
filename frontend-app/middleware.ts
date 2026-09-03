import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Trước đây chỉ /admin/* được chặn, các trang khác chỉ có API tự chặn nên user chưa đăng nhập vẫn thấy UI trước khi lỗi tải dữ liệu.
export async function middleware(req: NextRequest) {
  const isAdminPath = req.nextUrl.pathname.startsWith("/admin");
  const isMainPath = ["/chat", "/documents", "/tasks", "/reminders"].some((p) => req.nextUrl.pathname.startsWith(p));
  if (!isAdminPath && !isMainPath) return NextResponse.next();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.isActive === false || session.user.deletedAt) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isAdminPath && session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/admin/:path*", "/chat/:path*", "/documents/:path*", "/tasks/:path*", "/reminders/:path*"],
};