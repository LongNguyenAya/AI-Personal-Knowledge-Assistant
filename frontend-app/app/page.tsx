import Link from "next/link";
import { Bot } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const FEATURES = [
  {
    title: "Chat có trích dẫn nguồn",
    accent: "border-indigo-600",
    description:
      "Hỏi đáp trực tiếp trên tài liệu đã upload — câu trả lời luôn đi kèm nguồn thật, được kiểm tra qua 2 lớp trước khi hiển thị, không tự bịa thông tin ngoài tài liệu.",
  },
  {
    title: "Task & Reminder tự động",
    accent: "border-amber-500",
    description:
      "AI tự đọc tài liệu, tìm việc cần làm và deadline, đề xuất tạo nhắc nhở — bạn chỉ cần xác nhận thay vì tự rà soát từng trang tài liệu.",
  },
  {
    title: "Phân tích xu hướng",
    accent: "border-indigo-600",
    description:
      "Biểu đồ tự tính xu hướng công việc theo thời gian, kèm kiểm định thống kê — chỉ khẳng định có xu hướng khi đủ bằng chứng, tránh kết luận cảm tính.",
  },
];

// Domain gốc redirect theo session: chưa đăng nhập thì hiện landing page (không redirect thẳng
// sang /login như trước, trừ khi có lỗi verify email cần báo ngay), admin về dashboard, user
// thường về /chat. Làm ở server component nên không có khoảng trắng/flash nào hiện ra.
//
// better-auth cũng đưa user về đây (callbackURL mặc định "/") sau khi bấm link xác nhận email,
// kể cả khi verify lỗi (token hết hạn/không hợp lệ) — kèm ?error=... thay vì báo lỗi trực tiếp.
// Chuyển tiếp lỗi này sang /login để hiện thông báo, vì login page có sendOnSignIn nên user thử
// đăng nhập lại sẽ tự được gửi email xác nhận mới.
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });

  if (error) redirect(`/login?error=${encodeURIComponent(error)}`);
  if (session?.user.role === "admin") redirect("/admin/dashboard");
  if (session) redirect("/chat");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
        <span className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
          <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          AI Knowledge Assistant
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Đăng ký
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-20 text-center">
        <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
          Trợ lý tri thức cá nhân
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
          Quản lý tri thức và công việc, chính xác hơn
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-gray-600 dark:text-gray-400">
          AI Knowledge Assistant tổ chức tài liệu, task, reminder của bạn — trả lời có trích dẫn
          nguồn, tự đề xuất việc cần làm từ tài liệu, và phân tích xu hướng có kiểm định thống kê.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Bắt đầu miễn phí
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Đăng nhập
          </Link>
        </div>
      </main>

      <section className="border-t border-gray-200 bg-white px-6 py-16 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">Tính năng chính</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`rounded-xl border-l-4 ${f.accent} border-y border-r border-gray-200 bg-gray-50 p-5 shadow-soft dark:border-gray-800 dark:bg-gray-950`}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-6 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-600">
        AI Knowledge Assistant
      </footer>
    </div>
  );
}
