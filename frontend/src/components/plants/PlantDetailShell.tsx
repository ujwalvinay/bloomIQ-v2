"use client";

import { Bell, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { apiDelete } from "@/lib/api";
import { PlantSearchCombobox } from "./PlantSearchCombobox";
import { PlantDetailProvider, usePlantDetail } from "./PlantDetailContext";
import { initials } from "./plant-detail-shared";

const TAB_SEGMENTS = [
  "overview",
  "care-log",
  "gallery",
  "history",
] as const;

function navLinkClass(active: boolean): string {
  return `border-b-2 pb-1 transition ${
    active
      ? "border-forest text-forest"
      : "border-transparent text-ink/70 hover:text-forest"
  }`;
}

function resolveTabSegment(pathname: string, plantId: string): string {
  const prefix = `/plants/${plantId}/`;
  if (!pathname.startsWith(prefix)) return "overview";
  const rest = pathname.slice(prefix.length).split("/")[0] ?? "";
  if (rest && (TAB_SEGMENTS as readonly string[]).includes(rest)) {
    return rest;
  }
  return "overview";
}

function PlantDetailChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [headerSearch, setHeaderSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const {
    loading,
    error,
    user,
    plant,
    plantId,
    noteOpen,
    setNoteOpen,
    noteText,
    setNoteText,
    noteBusy,
    submitNote,
  } = usePlantDetail();

  const base = `/plants/${plantId}`;
  const segment = resolveTabSegment(pathname, plantId);

  if (loading && !plant) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-archive-cream px-8">
        <p className="text-sm text-muted">Opening archive…</p>
      </div>
    );
  }

  if (error && !plant) {
    return (
      <div className="bg-archive-cream px-6 py-10 lg:px-10">
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
        <Link
          href="/plants"
          className="mt-6 inline-flex text-sm font-semibold text-forest hover:underline"
        >
          ← Back to My Plants
        </Link>
      </div>
    );
  }

  if (!plant) return null;

  return (
    <div className="min-h-full bg-archive-cream pb-16">
        <header className="sticky top-0 z-30 border-b border-stone-200/60 bg-archive-cream/95 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
            <Link
              href="/plants"
              className="text-sm font-semibold tracking-tight text-forest"
            >
              Botanical Archive
            </Link>
            <nav
              className="order-3 flex w-full justify-center gap-8 text-xs font-semibold uppercase tracking-[0.12em] text-muted sm:order-none sm:w-auto"
              aria-label="Plant sections"
            >
              <Link
                href={`${base}/overview`}
                className={navLinkClass(segment === "overview")}
              >
                Overview
              </Link>
              <Link
                href={`${base}/care-log`}
                className={navLinkClass(segment === "care-log")}
              >
                Care chat
              </Link>
              <Link
                href={`${base}/gallery`}
                className={navLinkClass(segment === "gallery")}
              >
                Gallery
              </Link>
              <Link
                href={`${base}/history`}
                className={navLinkClass(segment === "history")}
              >
                History
              </Link>
            </nav>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:max-w-[min(100%,220px)] lg:max-w-xs">
              <PlantSearchCombobox
                value={headerSearch}
                onChange={setHeaderSearch}
                onNavigate={() => setHeaderSearch("")}
                compact
                placeholder="Search plants…"
                inputClassName="bg-white/90 ring-1 ring-stone-200/70"
                debounceMs={280}
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="rounded-full p-2 text-muted transition hover:bg-black/[0.04] hover:text-ink"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-archive-sage text-xs font-semibold text-forest"
                aria-hidden
              >
                {initials(user?.name ?? "?")}
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-10">
            <p
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-alert"
              role="alert"
            >
              {error}
            </p>
          </div>
        ) : null}

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          {children}
          <div className="mt-10 flex flex-col items-center gap-4 border-t border-stone-200/60 pt-8">
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Delete specimen
            </button>
            <p className="text-center">
              <Link
                href="/plants"
                className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
              >
                ← Back to My Plants
              </Link>
            </p>
          </div>
        </div>

        {deleteOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleteBusy) setDeleteOpen(false);
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2
                id="delete-dialog-title"
                className="text-lg font-semibold text-ink"
              >
                Remove this specimen?
              </h2>
              <p
                id="delete-dialog-desc"
                className="mt-3 text-sm leading-relaxed text-muted"
              >
                <strong className="font-semibold text-ink">{plant.name}</strong>{" "}
                will be removed from your archive. All{" "}
                <strong className="font-semibold text-ink">tasks</strong> for this
                plant (including watering and custom tasks),{" "}
                <strong className="font-semibold text-ink">care plans</strong>, and{" "}
                <strong className="font-semibold text-ink">activity history</strong>{" "}
                will be deleted. This cannot be undone.
              </p>
              {deleteError ? (
                <p className="mt-3 text-sm text-alert" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => setDeleteOpen(false)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:bg-stone-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={async () => {
                    setDeleteError(null);
                    setDeleteBusy(true);
                    try {
                      const res = await apiDelete<{ deleted: true }>(
                        `/api/plants/${plantId}`
                      );
                      if (!res.success) {
                        setDeleteError(res.error || res.message);
                        return;
                      }
                      setDeleteOpen(false);
                      router.push("/plants");
                      router.refresh();
                    } finally {
                      setDeleteBusy(false);
                    }
                  }}
                  className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusy ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {noteOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-dialog-title"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2
                id="note-dialog-title"
                className="text-lg font-semibold text-ink"
              >
                Add note
              </h2>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={4}
                placeholder="Observation, repot, pest check…"
                className="mt-4 w-full rounded-xl border-0 bg-stone-100 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:bg-white focus:ring-2 focus:ring-forest/25"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNoteOpen(false)}
                  className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={noteBusy || !noteText.trim()}
                  onClick={() => void submitNote()}
                  className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {noteBusy ? "Saving…" : "Save note"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
    </div>
  );
}

export function PlantDetailShell({
  plantId,
  children,
}: {
  plantId: string;
  children: ReactNode;
}) {
  return (
    <PlantDetailProvider plantId={plantId}>
      <PlantDetailChrome>{children}</PlantDetailChrome>
    </PlantDetailProvider>
  );
}
