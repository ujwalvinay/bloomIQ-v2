import { AppSidebar } from "@/components/layout/AppSidebar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <AppSidebar />
      <div className="min-h-screen min-w-0 flex-1 overflow-x-auto pl-[280px]">
        {children}
      </div>
    </div>
  );
}
