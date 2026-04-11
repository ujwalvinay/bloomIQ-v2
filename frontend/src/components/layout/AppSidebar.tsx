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
} from "lucide-react";
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

export function AppSidebar() {
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
    <aside className="fixed inset-y-0 left-0 z-40 flex h-screen w-[280px] shrink-0 flex-col overflow-y-auto bg-sidebar-bg px-4 py-8">
      <div className="px-3">
        <p className="text-lg font-bold tracking-tight text-sidebar-text">
          BloomIQ
        </p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-text/55">
          Botanical journal
        </p>
      </div>

      <nav className="mt-10 flex flex-1 flex-col gap-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
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

      <div className="mt-6 rounded-2xl bg-sidebar-active/90 px-4 py-5 text-center">
        <p className="text-sm font-medium leading-snug text-sidebar-text">
          Keep growing your knowledge.
        </p>
        <button
          type="button"
          className="mt-4 w-full rounded-full bg-olive-cta py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-olive-cta/90"
        >
          Upgrade to Pro
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-1 border-t border-sidebar-text/10 pt-6">
        <Link
          href="/help"
          className="flex items-center gap-3 rounded-full px-4 py-3 text-xs font-semibold uppercase tracking-wider text-sidebar-text/75 transition-colors hover:bg-black/[0.04] hover:text-sidebar-text"
        >
          <HelpCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
          Help center
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-text/75 transition-colors hover:bg-black/[0.04] hover:text-sidebar-text disabled:opacity-50"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
          {loggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
