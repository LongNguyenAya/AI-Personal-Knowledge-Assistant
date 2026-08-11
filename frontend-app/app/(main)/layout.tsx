import MainNav from "./_components/main-nav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <MainNav />
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
