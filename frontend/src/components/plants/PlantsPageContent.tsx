"use client";

import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Plus,
  Sprout,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { absoluteApiUrl } from "@/lib/backend-origin";
import { apiGet, type ApiEnvelope } from "@/lib/api";

type DashboardSummary = {
  totalPlants: number;
  healthyPlants: number;
  livingZones?: number;
};

type PlantRow = {
  _id: string;
  name: string;
  species?: string;
  location?: string;
  imageUrl?: string;
  status: string;
};

type CarePlanRow = {
  plantId: string;
  type: string;
  nextDueAt: string;
  isActive: boolean;
};

type PlantsListPayload = {
  items: PlantRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const PAGE_SIZE = 12;

const LOCATION_FILTERS: { label: string; value?: string }[] = [
  { label: "ALL" },
  { label: "LIVING ROOM", value: "Living Room" },
  { label: "BEDROOM", value: "Bedroom" },
  { label: "KITCHEN", value: "Kitchen" },
  { label: "GARDEN", value: "Garden" },
  { label: "COURTYARD", value: "Courtyard" },
  { label: "OFFICE", value: "Office" },
];

type SortKey = "watering" | "name" | "recent";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "watering", label: "Watering" },
  { key: "name", label: "Name (A–Z)" },
  { key: "recent", label: "Recently added" },
];

function daysUntilNextWater(nextDueIso: string): number {
  const due = new Date(nextDueIso).getTime();
  return Math.ceil((due - Date.now()) / 86400000);
}

function wateringLine(nextDueIso: string | undefined): { text: string; overdue: boolean } {
  if (!nextDueIso) return { text: "No schedule", overdue: false };
  const days = daysUntilNextWater(nextDueIso);
  if (days < 0) return { text: "Overdue", overdue: true };
  if (days === 0) return { text: "Today", overdue: false };
  if (days === 1) return { text: "Tomorrow", overdue: false };
  return { text: `In ${days} days`, overdue: false };
}

function happinessScore(total: number, healthy: number): number {
  if (total <= 0) return 100;
  return Math.min(100, Math.round((healthy / total) * 100));
}

export function PlantsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
  const locationFromUrl = searchParams.get("location") ?? "";
  const rawSort = searchParams.get("sort") as SortKey | null;
  const sortFromUrl: SortKey =
    rawSort && SORT_OPTIONS.some((o) => o.key === rawSort) ? rawSort : "watering";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [list, setList] = useState<PlantsListPayload | null>(null);
  const [waterByPlant, setWaterByPlant] = useState<Map<string, string>>(new Map());
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>(sortFromUrl);

  useEffect(() => {
    setSort(sortFromUrl);
  }, [sortFromUrl]);

  const activeLocation = locationFromUrl;

  const syncUrl = useCallback(
    (next: { page?: number; location?: string; sort?: SortKey }) => {
      const p = new URLSearchParams(searchParams.toString());
      const pg = next.page ?? pageFromUrl;
      const loc = next.location !== undefined ? next.location : activeLocation;
      const s = next.sort ?? sort;
      if (pg <= 1) p.delete("page");
      else p.set("page", String(pg));
      if (!loc) p.delete("location");
      else p.set("location", loc);
      if (s === "watering") p.delete("sort");
      else p.set("sort", s);
      const qs = p.toString();
      router.push(qs ? `/plants?${qs}` : "/plants", { scroll: false });
    },
    [searchParams, router, pageFromUrl, activeLocation, sort]
  );

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const loc = activeLocation;
    const sortParam =
      sort === "recent" ? "recent" : sort === "name" ? "name" : "watering";
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(pageFromUrl),
      sort: sortParam,
    });
    if (loc) qs.set("location", loc);

    const [sumRes, plantsRes, plansRes]: [
      ApiEnvelope<DashboardSummary>,
      ApiEnvelope<PlantsListPayload>,
      ApiEnvelope<CarePlanRow[]>,
    ] = await Promise.all([
      apiGet<DashboardSummary>("/api/dashboard/summary"),
      apiGet<PlantsListPayload>(`/api/plants?${qs.toString()}`),
      apiGet<CarePlanRow[]>("/api/care-plans?isActive=true&type=watering"),
    ]);

    if (!sumRes.success && sumRes.error?.toLowerCase().includes("auth")) {
      router.push("/login");
      return;
    }

    const failed = !sumRes.success || !plantsRes.success || !plansRes.success;
    if (
      failed ||
      !sumRes.data ||
      !plantsRes.data ||
      !Array.isArray(plansRes.data)
    ) {
      setError(
        sumRes.error ||
          plantsRes.error ||
          plansRes.error ||
          "Could not load plants."
      );
      setLoading(false);
      return;
    }

    const wMap = new Map<string, string>();
    for (const cp of plansRes.data) {
      if (cp.type === "watering" && cp.isActive) {
        wMap.set(cp.plantId, cp.nextDueAt);
      }
    }

    setSummary(sumRes.data);
    setList(plantsRes.data);
    setWaterByPlant(wMap);
    setLoading(false);
  }, [router, pageFromUrl, activeLocation, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!sortMenuRef.current?.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const totalPages = list?.totalPages ?? 1;
  const currentPage = list?.page ?? pageFromUrl;

  const activeSortLabel = useMemo(
    () => SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "Watering",
    [sort]
  );

  function setPage(p: number) {
    syncUrl({ page: Math.max(1, Math.min(totalPages, p)) });
  }

  function selectLocation(value: string | undefined) {
    syncUrl({ page: 1, location: value ?? "" });
  }

  function selectSort(next: SortKey) {
    setSort(next);
    setSortOpen(false);
    syncUrl({ page: 1, sort: next });
  }

  if (loading && !list) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-plants-canvas px-8">
        <p className="text-sm text-muted">Loading your collection…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="bg-plants-canvas p-8 lg:p-10">
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      </div>
    );
  }

  const zones = summary?.livingZones ?? 0;
  const happy = happinessScore(
    summary?.totalPlants ?? 0,
    summary?.healthyPlants ?? 0
  );

  return (
    <div className="min-h-full bg-plants-canvas pb-16">
      <div className="border-b border-stone-200/50 bg-plants-canvas/95 px-6 py-8 backdrop-blur-sm lg:px-10 lg:py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-ink lg:text-[2rem]">
          My Plants
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Curating your indoor forest. Currently nurturing{" "}
          <span className="font-semibold text-ink">
            {summary?.totalPlants ?? 0}
          </span>{" "}
          biological companion
          {(summary?.totalPlants ?? 0) === 1 ? "" : "s"} across{" "}
          <span className="font-semibold text-ink">{zones}</span> living{" "}
          {zones === 1 ? "zone" : "zones"}.
        </p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {LOCATION_FILTERS.map(({ label, value }) => {
              const active = value ? activeLocation === value : !activeLocation;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => selectLocation(value)}
                  className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                    active
                      ? "bg-forest text-white shadow-sm"
                      : "bg-white text-ink ring-1 ring-stone-200/80 hover:bg-stone-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative shrink-0" ref={sortMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSortOpen((o) => !o);
              }}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-ink ring-1 ring-stone-200/80 transition hover:bg-stone-50"
            >
              <span className="text-muted">Sort by:</span>
              {activeSortLabel}
              <ChevronDown className="h-4 w-4 text-forest" strokeWidth={2} />
            </button>
            {sortOpen ? (
              <ul
                className="absolute right-0 z-20 mt-2 min-w-[200px] overflow-hidden rounded-2xl bg-white py-1 shadow-lg ring-1 ring-stone-200/80"
                role="listbox"
              >
                {SORT_OPTIONS.map((opt) => (
                  <li key={opt.key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={sort === opt.key}
                      onClick={() => selectSort(opt.key)}
                      className={`flex w-full px-4 py-2.5 text-left text-sm ${
                        sort === opt.key
                          ? "bg-sage/50 font-semibold text-forest"
                          : "text-ink hover:bg-stone-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="px-6 pt-4 lg:px-10">
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-alert" role="alert">
            {error}
          </p>
        </div>
      ) : null}

      <div className="px-6 py-8 lg:px-10 lg:py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list?.items.map((plant) => {
            const nextWater = waterByPlant.get(plant._id);
            const { text: waterText, overdue: waterOverdue } =
              wateringLine(nextWater);
            const needsAttention = plant.status === "needs_attention";
            const imgSrc =
              plant.imageUrl?.startsWith("/api/plants/") && plant.imageUrl
                ? absoluteApiUrl(plant.imageUrl)
                : plant.imageUrl;

            return (
              <article
                key={plant._id}
                className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] ring-1 ring-stone-200/50"
              >
                <div className="relative aspect-square bg-stone-100">
                  {imgSrc ? (
                    plant.imageUrl?.startsWith("/api/plants/") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- cookie-auth binary route
                      <img
                        src={imgSrc}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={imgSrc}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 25vw"
                      />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-stone-200/60 text-forest/40">
                      <Sprout className="h-14 w-14" strokeWidth={1.25} />
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm ${
                        needsAttention ? "bg-alert/90" : "bg-black/35"
                      }`}
                    >
                      {needsAttention ? "Needs attention" : "Healthy"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted">
                    {(plant.location ?? "Unknown").toUpperCase()}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">
                    {plant.name}
                  </h2>
                  <div className="mt-auto flex items-end justify-between pt-6">
                    <div className="flex items-center gap-1.5">
                      <Droplets
                        className={`h-4 w-4 shrink-0 ${
                          waterOverdue ? "text-alert" : "text-forest"
                        }`}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span
                        className={`text-xs font-medium ${
                          waterOverdue ? "text-alert" : "text-muted"
                        }`}
                      >
                        {waterText}
                      </span>
                    </div>
                    <Link
                      href={`/plants/${plant._id}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-sage text-forest transition hover:bg-sage/80"
                      aria-label={`Open ${plant.name}`}
                    >
                      <ArrowRight className="h-5 w-5" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          <Link
            href="/plants/add"
            className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300/90 bg-white/40 px-6 text-center transition hover:border-forest/40 hover:bg-white/70"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage/80 text-forest">
              <Plus className="h-7 w-7" strokeWidth={2} />
            </div>
            <p className="mt-5 text-lg font-semibold text-ink">New Specimen</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              Add to your collection
            </p>
          </Link>
        </div>
      </div>

      <footer className="border-t border-stone-200/60 bg-white/60 px-6 py-6 lg:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold uppercase tracking-[0.15em] text-muted">
            <p>
              <span className="text-ink">Total plants:</span>{" "}
              <span className="text-lg font-semibold text-forest">
                {summary?.totalPlants ?? 0}
              </span>
            </p>
            <span className="hidden h-8 w-px bg-stone-200 sm:block" aria-hidden />
            <p>
              <span className="text-ink">Happiness score:</span>{" "}
              <span className="text-lg font-semibold text-forest">{happy}%</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-forest shadow-sm ring-1 ring-stone-200/80 transition enabled:hover:bg-sage/40 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2} />
            </button>
            <p className="min-w-[120px] text-center text-xs font-semibold uppercase tracking-wider text-muted">
              Page {currentPage} of {totalPages}
            </p>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-forest shadow-sm ring-1 ring-stone-200/80 transition enabled:hover:bg-sage/40 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
