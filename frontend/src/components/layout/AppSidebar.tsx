"use client";

import {
  BarChart3,
  Calendar,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  PlusCircle,
  Settings,
  Sprout,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plants", label: "My plants", icon: Sprout },
  { href: "/plants/add", label: "Add plant", icon: PlusCircle },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/plants/add") return pathname.startsWith("/plants/add");
  if (href === "/plants") {
    if (pathname === "/plants") return true;
    if (pathname.startsWith("/plants/") && !pathname.startsWith("/plants/add")) {
      return true;
    }
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppSidebarProps = {
  id?: string;
  className?: string;
  /** Called after navigating to a sidebar route (e.g. close mobile drawer). */
  onNavigate?: () => void;
  showMobileClose?: boolean;
  onMobileClosePress?: () => void;
};

export function AppSidebar({
  id,
  className = "",
  onNavigate,
  showMobileClose,
  onMobileClosePress,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  return (
    <aside
      id={id}
      className={`fixed inset-y-0 left-0 z-40 flex h-[100dvh] max-h-screen w-[min(280px,92vw)] shrink-0 flex-col overflow-y-auto bg-sidebar-bg px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:w-[280px] lg:h-screen lg:w-[280px] lg:py-8 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href="/dashboard"
          onClick={() => onNavigate?.()}
          className="mx-1 block min-w-0 flex-1 outline-none ring-sidebar-text/20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg sm:mx-3"
        >
          <Image
            src="/logo.png"
            alt="BloomIQ"
            width={220}
            height={124}
            className="h-24 w-auto max-w-full object-contain object-left sm:h-28"
            priority
          />
        </Link>
        {showMobileClose ? (
          <button
            type="button"
            onClick={() => onMobileClosePress?.()}
            className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sidebar-text transition hover:bg-black/[0.06] lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto lg:mt-10">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onNavigate?.()}
              className={`flex min-h-[44px] items-center gap-3 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? "bg-sidebar-active text-sidebar-text"
                  : "text-sidebar-text/75 hover:bg-black/[0.04] hover:text-sidebar-text"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      

      <div className="mt-6 flex flex-col gap-1 border-t border-sidebar-text/10 pt-6">
        <Link
          href="/help"
          onClick={() => onNavigate?.()}
          className="flex min-h-[44px] items-center gap-3 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sidebar-text/75 transition-colors hover:bg-black/[0.04] hover:text-sidebar-text"
        >
          <HelpCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
          Help center
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex min-h-[44px] w-full items-center gap-3 rounded-full px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-text/75 transition-colors hover:bg-black/[0.04] hover:text-sidebar-text disabled:opacity-50"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
          {loggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
