"use client";

import { Bell, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen bg-cream">
      <header className="fixed left-0 right-0 top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top,0px))] min-h-[3.5rem] items-center gap-2 border-b border-sidebar-text/10 bg-sidebar-bg px-3 pt-[env(safe-area-inset-top,0px)] lg:hidden">
        <Link
          href="/dashboard"
          className="flex min-w-0 shrink-0 items-center outline-none ring-sidebar-text/20 focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg"
        >
          <Image
            src="/logo.png"
            alt="BloomIQ"
            width={160}
            height={56}
            className="h-10 w-auto max-w-[min(180px,48vw)] object-contain object-left"
            priority
          />
        </Link>
        <span className="min-w-2 flex-1" aria-hidden />
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sidebar-text transition hover:bg-black/[0.06]"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sidebar-text transition hover:bg-black/[0.06]"
          aria-expanded={mobileNavOpen}
          aria-controls="app-mobile-nav"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={closeNav}
        />
      ) : null}

      <AppSidebar
        id="app-mobile-nav"
        className={`transition-transform duration-200 ease-out max-lg:shadow-[4px_0_24px_rgba(0,0,0,0.12)] ${
          mobileNavOpen
            ? "max-lg:translate-x-0 max-lg:pointer-events-auto"
            : "max-lg:-translate-x-full max-lg:pointer-events-none"
        } lg:translate-x-0 lg:pointer-events-auto`}
        onNavigate={closeNav}
        showMobileClose
        onMobileClosePress={closeNav}
      />

      <div className="min-h-screen min-w-0 flex-1 overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)] pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pb-0 lg:pl-[280px] lg:pt-0">
        {children}
      </div>
    </div>
  );
}
