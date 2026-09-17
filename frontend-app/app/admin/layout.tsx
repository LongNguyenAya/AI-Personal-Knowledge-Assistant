import AdminHeader from "./_components/admin-header";
import AdminSidebar from "./_components/admin-sidebar";

// Doesn't re-check the role here since middleware.ts already blocks every request to /admin/* before rendering if not an admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // h-screen + overflow-hidden on the outer frame locks page-level scrolling, overflow-y-auto is only set on <main> so it scrolls independently.
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      <AdminHeader />
      {/* flex-col on mobile, same reason as (main)/layout.tsx: AdminSidebar renders a "Menu"
          button (not a sidebar) on narrow screens, so it has to stack above main instead of sitting beside it. */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <AdminSidebar />
        {/* No longer wrapping children in mx-auto max-w-4xl, too narrow for grid-based layouts
            (Dashboard, Prompts). Any page that needs to cap its own width sets it itself. */}
        <main className="flex-1 overflow-y-auto overflow-x-auto p-8">{children}</main>
      </div>
    </div>
  );
}
