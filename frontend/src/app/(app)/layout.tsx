import { AppSidebar } from "@/components/layout/AppSidebar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-cream">
      <AppSidebar />
      <div className="min-w-0 flex-1 overflow-x-auto">{children}</div>
    </div>
  );
}
