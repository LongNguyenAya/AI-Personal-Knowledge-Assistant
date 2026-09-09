import Link from "next/link";
import { Bot, MessageSquare, CheckSquare, FileText, TrendingUp, ShieldCheck, LayoutDashboard, Upload } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { Reveal } from "@/components/Reveal";

// 6 real features already in the app, each description maps to existing code, not imagined marketing copy.
const FEATURES = [
  {
    icon: MessageSquare,
    tile: "indigo" as const,
    title: "Chat with source citations",
    description:
      "Answers always cite real sources from your documents, checked in 2 steps before showing. Ask something outside your documents and the AI declines instead of making things up.",
  },
  {
    icon: CheckSquare,
    tile: "amber" as const,
    title: "Automatic tasks & reminders",
    description:
      "AI reads your documents, finds action items and deadlines, and suggests reminders. Always waits for your confirmation before creating anything.",
  },
  {
    icon: FileText,
    tile: "indigo" as const,
    title: "Summarize & compare documents",
    description:
      "When a question needs the full text instead of just one relevant excerpt, the AI reads the entire document for a more accurate summary or comparison.",
  },
  {
    icon: TrendingUp,
    tile: "amber" as const,
    title: "Statistical trend analysis",
    description:
      "Linear regression with statistical significance testing. Only claims a trend when there's enough evidence, never a guess.",
  },
  {
    icon: ShieldCheck,
    tile: "indigo" as const,
    title: "Account security",
    description:
      "Mandatory email verification, password reset links that expire in 1 hour, and every old session revoked after a password change.",
  },
  {
    icon: LayoutDashboard,
    tile: "amber" as const,
    title: "System administration",
    description:
      "A dashboard tracking real metrics, trend charts over time, and AI analysis the admin can request on demand.",
  },
];

const STEPS = [
  {
    number: "01",
    icon: Upload,
    tile: "indigo" as const,
    title: "Upload a document",
    description: "Upload a document and a background worker splits it into chunks, creates embeddings, and indexes it, so you're never blocked while it processes.",
  },
  {
    number: "02",
    icon: MessageSquare,
    tile: "amber" as const,
    title: "Ask or request",
    description: "Ask a question naturally, or have the AI scan a document for action items. It picks the right tool for each kind of request.",
  },
  {
    number: "03",
    icon: CheckSquare,
    tile: "indigo" as const,
    title: "Get results with sources",
    description: "Answers come with citations, or a task/reminder proposal waiting for your approval. Nothing gets created silently.",
  },
];

const EXAMPLES = [
  { icon: MessageSquare, tile: "indigo" as const, text: `"What open action items are in the Sprint 3 rollout plan document?"` },
  { icon: CheckSquare, tile: "amber" as const, text: `"Check this document and create a reminder if there's an upcoming deadline."` },
  { icon: TrendingUp, tile: "indigo" as const, text: `"Chart the number of tasks completed per week recently."` },
];

const TILE_STYLE = {
  indigo: "border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-400",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
};

// Root domain redirects based on session, better-auth also sends users here with ?error=... on verify failure so it forwards to /login.
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
            Features
          </a>
          <a href="#how-it-works" className="hover:text-gray-900 dark:hover:text-white">
            How it works
          </a>
          <a href="#try-it" className="hover:text-gray-900 dark:hover:text-white">
            Try it
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle variant="inline" />
          <Link
            href="/login"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Sign up
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
              Personal knowledge assistant
            </span>
          </Reveal>
          <Reveal delay={1}>
            <h1 className="headline-grad mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Manage knowledge and work, more accurately
            </h1>
          </Reveal>
          <Reveal delay={2}>
            <p className="mx-auto mt-5 max-w-xl text-base text-gray-600 dark:text-gray-400">
              AI Knowledge Assistant organizes your documents, tasks, and reminders. It answers with
              cited sources, suggests action items from your documents, and analyzes trends with statistical testing.
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
                  Start for free
                </Link>
              </div>
              <Link
                href="/login"
                className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Log in
              </Link>
            </div>
          </Reveal>
        </main>
      </div>

      <section id="features" className="scroll-mt-[72px] border-t border-gray-200 bg-white px-6 py-18 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="mx-auto max-w-xl text-center">
              <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase dark:text-indigo-400">Features</p>
              <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">Built to be trustworthy</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Every feature is backed by real data. No number or answer here is made up.
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
              <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase dark:text-indigo-400">How it works</p>
              <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">Three steps, no black box</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                Every answer can be traced back to its source. You always know where the AI got its information.
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
              <p className="text-xs font-bold tracking-[0.16em] text-indigo-600 uppercase dark:text-indigo-400">Try it</p>
              <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">A few questions you can try right now</h2>
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
          <h2 className="text-[28px] font-extrabold tracking-tight text-gray-900 dark:text-white">Start managing your knowledge</h2>
          <p className="mt-2.5 text-sm text-gray-500 dark:text-gray-400">Create a free account, upload your first document, and start asking right away.</p>
          <div className="relative mt-6 inline-block">
            <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-amber-500 opacity-35 blur-lg" />
            <Link
              href="/register"
              className="relative block rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Start for free
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
