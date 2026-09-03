import Link from "next/link";
import { Bot, MessageSquare, CheckSquare, FileText, TrendingUp, ShieldCheck, LayoutDashboard, Upload } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { Reveal } from "@/components/Reveal";

// 6 tính năng thật đã có trong app, mỗi mô tả ứng đúng 1 phần code đã tồn tại, không phải marketing copy tưởng tượng.
const FEATURES = [
  {
    icon: MessageSquare,
    tile: "indigo" as const,
    title: "Chat có trích dẫn nguồn",
    description:
      "Câu trả lời luôn kèm nguồn thật từ tài liệu, qua 2 lớp kiểm tra trước khi hiển thị — hỏi ngoài phạm vi tài liệu thì AI từ chối thay vì bịa.",
  },
  {
    icon: CheckSquare,
    tile: "amber" as const,
    title: "Task & Reminder tự động",
    description:
      "AI đọc tài liệu, tự tìm việc cần làm và deadline, đề xuất tạo nhắc nhở — luôn cần bạn xác nhận trước khi tạo.",
  },
  {
    icon: FileText,
    tile: "indigo" as const,
    title: "Tóm tắt & so sánh tài liệu",
    description:
      "Khi cần đọc toàn văn thay vì chỉ 1 đoạn liên quan, AI chuyển sang đọc nguyên tài liệu để tóm tắt hoặc so sánh chính xác hơn.",
  },
  {
    icon: TrendingUp,
    tile: "amber" as const,
    title: "Phân tích xu hướng thống kê",
    description:
      "Hồi quy tuyến tính, kiểm định ý nghĩa thống kê — chỉ khẳng định có xu hướng khi đủ bằng chứng, không đoán mò.",
  },
  {
    icon: ShieldCheck,
    tile: "indigo" as const,
    title: "Bảo mật tài khoản",
    description:
      "Bắt buộc xác nhận email, tự đặt lại mật khẩu qua link hết hạn sau 1 tiếng, huỷ mọi phiên cũ sau khi đổi mật khẩu.",
  },
  {
    icon: LayoutDashboard,
    tile: "amber" as const,
    title: "Quản trị hệ thống",
    description:
      "Dashboard theo dõi số liệu thật, biểu đồ theo thời gian và phân tích AI theo yêu cầu chủ động của admin.",
  },
];

const STEPS = [
  {
    number: "01",
    icon: Upload,
    tile: "indigo" as const,
    title: "Tải tài liệu lên",
    description: "Upload tài liệu — hệ thống tự tách đoạn, tạo embedding và lập chỉ mục ở worker nền, không chặn bạn dùng app trong lúc chờ.",
  },
  {
    number: "02",
    icon: MessageSquare,
    tile: "amber" as const,
    title: "Hỏi hoặc yêu cầu",
    description: "Đặt câu hỏi tự nhiên, hoặc nhờ AI đọc 1 tài liệu để tìm việc cần làm — AI tự chọn đúng công cụ cho từng loại yêu cầu.",
  },
  {
    number: "03",
    icon: CheckSquare,
    tile: "indigo" as const,
    title: "Nhận kết quả kèm nguồn",
    description: "Câu trả lời có trích dẫn, hoặc đề xuất task/reminder chờ bạn xác nhận — không có gì được tạo ra âm thầm.",
  },
];

const EXAMPLES = [
  { icon: MessageSquare, tile: "indigo" as const, text: `"Tài liệu Kế hoạch triển khai Sprint 3 có những đầu việc nào chưa xử lý?"` },
  { icon: CheckSquare, tile: "amber" as const, text: `"Xem tài liệu này và tạo nhắc nhở nếu có deadline nào sắp tới."` },
  { icon: TrendingUp, tile: "indigo" as const, text: `"Vẽ biểu đồ số task hoàn thành theo tuần gần đây."` },
];

const TILE_STYLE = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
};

// Domain gốc redirect theo session, better-auth cũng đưa user về đây kèm ?error=... khi verify lỗi nên chuyển tiếp sang /login.
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });

  if (error) redirect(`/login?error=${encodeURIComponent(error)}`);
  if (session?.user.role === "admin") redirect("/admin/dashboard");
  if (session) redirect("/chat");

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900">
        <span className="flex items-center gap-2.5 text-sm font-bold text-gray-900 dark:text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-600 to-amber-500">
            <Bot className="h-[18px] w-[18px] text-white" />
          </span>
          AI Knowledge Assistant
        </span>
        <nav className="hidden items-center gap-7 text-[13px] text-gray-600 md:flex dark:text-gray-400">
          <a href="#features" className="hover:text-gray-900 dark:hover:text-white">
            Tính năng
          </a>
          <a href="#how-it-works" className="hover:text-gray-900 dark:hover:text-white">
            Cách hoạt động
          </a>
          <a href="#try-it" className="hover:text-gray-900 dark:hover:text-white">
            Dùng thử
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle variant="inline" />
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

      <div className="relative isolate flex-1 overflow-hidden">
        <div aria-hidden className="hero-bg">
          <div className="hero-bg-grid" />
          <div className="hero-bg-orb hero-bg-orb-indigo" />
          <div className="hero-bg-orb hero-bg-orb-amber" />
        </div>
        <main className="relative mx-auto w-full max-w-3xl px-6 py-20 text-center">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Trợ lý tri thức cá nhân
            </span>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="headline-grad mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Quản lý tri thức và công việc, chính xác hơn
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mx-auto mt-5 max-w-xl text-base text-gray-600 dark:text-gray-400">
              AI Knowledge Assistant tổ chức tài liệu, task, reminder của bạn — trả lời có trích dẫn
              nguồn, tự đề xuất việc cần làm từ tài liệu, và phân tích xu hướng có kiểm định thống kê.
            </p>
          </Reveal>
          <Reveal delay={3}>
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-amber-500 opacity-35 blur-lg" />
                <Link
                  href="/register"
                  className="relative block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Bắt đầu miễn phí
                </Link>
              </div>
              <Link
                href="/login"
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Đăng nhập
              </Link>
            </div>
          </Reveal>
        </main>
      </div>

      <section id="features" className="scroll-mt-[72px] border-t border-gray-200 bg-white px-6 py-18 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="mx-auto max-w-xl text-center">
              <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase dark:text-indigo-400">Tính năng</p>
              <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">Được xây dựng để đáng tin cậy</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Mỗi tính năng đều có nguồn dữ liệu thật đứng sau — không có con số hay câu trả lời nào bị bịa ra.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6}>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-soft dark:border-gray-800 dark:bg-gray-950">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] border ${TILE_STYLE[f.tile]}`}>
                    <f.icon className="h-[18px] w-[18px]" />
                  </div>
                  <h3 className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">{f.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{f.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-[72px] px-6 py-18">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="mx-auto max-w-xl text-center">
              <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase dark:text-indigo-400">Cách hoạt động</p>
              <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">Ba bước, không hộp đen</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Mỗi câu trả lời đều có thể truy ngược lại đúng nguồn — bạn luôn biết AI lấy thông tin từ đâu.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.number} delay={(i + 1) as 1 | 2 | 3}>
                <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-soft dark:border-gray-800 dark:bg-gray-900">
                  <div className="absolute top-1.5 right-3.5 text-5xl font-extrabold text-indigo-600/[0.06] dark:text-indigo-400/10">{s.number}</div>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-[10px] border ${TILE_STYLE[s.tile]}`}>
                    <s.icon className="h-[17px] w-[17px]" />
                  </div>
                  <h3 className="relative mt-3 text-[15px] font-bold text-gray-900 dark:text-white">{s.title}</h3>
                  <p className="relative mt-1.5 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{s.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="try-it" className="scroll-mt-[72px] border-t border-gray-200 bg-white px-6 py-18 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="mx-auto max-w-xl text-center">
              <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase dark:text-indigo-400">Dùng thử</p>
              <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">Vài câu hỏi bạn có thể thử ngay</h2>
            </div>
          </Reveal>

          <div className="mt-8 flex flex-col gap-2.5">
            {EXAMPLES.map((ex, i) => (
              <Reveal key={i} delay={(i + 1) as 1 | 2 | 3}>
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-soft dark:border-gray-800 dark:bg-gray-950">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border ${TILE_STYLE[ex.tile]}`}>
                    <ex.icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{ex.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <Reveal className="mx-auto max-w-lg">
          <h2 className="text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">Bắt đầu quản lý tri thức của bạn</h2>
          <p className="mt-2.5 text-sm text-gray-500 dark:text-gray-400">Tạo tài khoản miễn phí, upload tài liệu đầu tiên và thử hỏi ngay.</p>
          <div className="relative mt-6 inline-block">
            <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-amber-500 opacity-35 blur-lg" />
            <Link
              href="/register"
              className="relative block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Bắt đầu miễn phí
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-6 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-600">
        AI Knowledge Assistant
      </footer>
    </div>
  );
}
