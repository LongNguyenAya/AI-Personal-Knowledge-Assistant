import MainNav from "./_components/main-nav";
import { WsProvider } from "@/components/WsProvider";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // flex-col on mobile so MainNav stacks above <main>, h-screen pins it at 100vh, WsProvider sits here since WS is only needed inside the logged-in area.
  return (
    <WsProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-gray-50 md:flex-row dark:bg-gray-950">
        <MainNav />
        {/* No max-width capped here, the chat page needs to use all the remaining width, while
            list pages (tasks/reminders/documents) cap their own max-w-4xl inside their own files. */}
        <main className="min-h-0 flex-1 overflow-x-auto overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </WsProvider>
  );
}
