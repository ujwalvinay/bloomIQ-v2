"use client";

import type { ReactNode } from "react";
import {
  Leaf,
  Share2,
  Sprout,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { absoluteApiUrl } from "@/lib/backend-origin";
import { apiGet, type ApiEnvelope } from "@/lib/api";

type ActivityRow = {
  _id: string;
  plantId: string;
  action: string;
  date: string;
  notes?: string;
};

type DashboardSummary = {
  totalPlants: number;
  healthyPlants: number;
  needsAttentionPlants: number;
  livingZones: number;
  tasksDueToday: number;
  overdueTasks: number;
  completedThisWeek: number;
  recentActivities: ActivityRow[];
};

type Plant = {
  _id: string;
  name: string;
  species?: string;
  location?: string;
  imageUrl?: string;
  status: string;
};

function plantImageSrc(plant: Plant | undefined): string | null {
  if (!plant?.imageUrl) return null;
  if (plant.imageUrl.startsWith("/api/")) {
    return absoluteApiUrl(plant.imageUrl);
  }
  return plant.imageUrl;
}

function categorizePlant(p: Plant): "tropical" | "succulent" | "fern" {
  const s = `${p.species ?? ""} ${p.name}`.toLowerCase();
  if (
    /(succulent|cactus|aloe|jade|haworthia|echeveria|sedum|crassula)/.test(s)
  ) {
    return "succulent";
  }
  if (/(fern|moss|pothos|ivy|maidenhair|asplenium)/.test(s)) {
    return "fern";
  }
  return "tropical";
}

function formatRelativeCaps(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "JUST NOW";
  if (hours < 1) return `${mins} MIN AGO`;
  if (hours < 24) return `${hours} HOUR${hours === 1 ? "" : "S"} AGO`;
  if (days === 1) return "YESTERDAY";
  if (days < 7) return `${days} DAYS AGO`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function healthBadge(score: number): string {
  if (score >= 85) return "OPTIMAL";
  if (score >= 65) return "STABLE";
  if (score >= 45) return "ATTENTION";
  return "AT RISK";
}

function growthBadge(completedWeek: number, totalPlants: number): string {
  if (totalPlants === 0) return "START";
  const rate = completedWeek / Math.max(totalPlants, 1);
  if (rate >= 0.5) return "ACCELERATING";
  if (rate >= 0.2) return "STEADY";
  return "BUILDING";
}

function growthPercent(completedWeek: number, totalPlants: number): string {
  if (totalPlants === 0) return "+0%";
  const base = Math.min(18, Math.round((completedWeek / totalPlants) * 40));
  const sign = base >= 0 ? "+" : "";
  return `${sign}${Math.max(3, base)}%`;
}

function distinctSpeciesCount(plants: Plant[]): number {
  const set = new Set<string>();
  for (const p of plants) {
    const key = (p.species ?? "").trim() || p.name.trim();
    if (key) set.add(key.toLowerCase());
  }
  return Math.max(set.size, plants.length > 0 ? 1 : 0);
}

function speciesBadge(count: number, total: number): string {
  if (total === 0) return "EMPTY";
  if (count <= 3) return "FOCUSED";
  if (count <= 8) return "STABLE";
  return "DIVERSE";
}

const GROWTH_BARS = [28, 32, 38, 44, 52, 58, 68, 78, 92];

const METABOLIC_BARS: { water: number; nutrients: number }[] = [
  { water: 42, nutrients: 28 },
  { water: 55, nutrients: 22 },
  { water: 38, nutrients: 35 },
  { water: 62, nutrients: 18 },
  { water: 48, nutrients: 32 },
  { water: 70, nutrients: 15 },
  { water: 52, nutrients: 28 },
  { water: 45, nutrients: 30 },
];

function milestoneFromActivity(
  a: ActivityRow,
  plant?: Plant,
): { title: string; body: string; time: string } {
  const name = plant?.name ?? "Your plant";
  const loc = plant?.location?.trim();
  const time = formatRelativeCaps(a.date);
  switch (a.action) {
    case "watered":
      return {
        title: `${name} is hydrated`,
        body: loc
          ? `Watering logged in ${loc}. Keep the rhythm going.`
          : "Watering logged. Steady care builds strong roots.",
        time,
      };
    case "fertilized":
      return {
        title: `${name} got a nutrient boost`,
        body: loc
          ? `Fed in ${loc}. Seasonal feeding supports new growth.`
          : "Fertilizing logged to support leafy growth.",
        time,
      };
    case "pruned":
      return {
        title: `${name} was pruned`,
        body: loc
          ? `Trimmed in ${loc}. Shaping encourages fuller growth.`
          : "Pruning logged to shape healthy structure.",
        time,
      };
    case "custom_task_done":
      return {
        title: "Custom task completed",
        body: a.notes?.trim() || `Checked off for ${name}.`,
        time,
      };
    default:
      return {
        title: `Update for ${name}`,
        body: a.notes?.trim() || "Activity recorded in your conservatory log.",
        time,
      };
  }
}

function KpiCard({
  icon,
  badge,
  label,
  value,
}: {
  icon: ReactNode;
  badge: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] bg-white p-5 shadow-soft ring-1 ring-black/[0.04] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sage/90 text-forest">
          {icon}
        </span>
        <span className="rounded-full bg-sage/70 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-forest">
          {badge}
        </span>
      </div>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-ink">{value}</p>
    </div>
  );
}

function CollectionGrowthChart() {
  const max = Math.max(...GROWTH_BARS, 1);
  const w = 320;
  const h = 120;
  const padX = 8;
  const barW = (w - padX * 2) / GROWTH_BARS.length - 4;
  const pts = GROWTH_BARS.map((v, i) => {
    const x = padX + i * ((w - padX * 2) / (GROWTH_BARS.length - 1));
    const barH = (v / max) * (h - 24);
    const y = h - 8 - barH;
    return { x, y, v, i };
  });
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x + barW / 2} ${p.y - 4}`)
    .join(" ");

  return (
    <div className="relative">
      <div className="flex h-[200px] items-end justify-between gap-1 px-1 sm:gap-2">
        {GROWTH_BARS.map((v, i) => {
          const hPct = (v / max) * 100;
          const isLast = i === GROWTH_BARS.length - 1;
          return (
            <div
              key={i}
              className="relative flex flex-1 flex-col items-center justify-end"
            >
              <div
                className={`w-full max-w-[2.25rem] rounded-t-lg transition-all ${
                  isLast
                    ? "bg-forest"
                    : i % 3 === 0
                      ? "bg-sage"
                      : "bg-olive/50"
                }`}
                style={{ height: `${hPct * 0.85}%`, minHeight: "0.5rem" }}
              />
            </div>
          );
        })}
      </div>
      <svg
        className="pointer-events-none absolute inset-0 h-[200px] w-full overflow-visible"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-3 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted">
        <span>Week 01</span>
        <span className="hidden sm:inline">Week 04</span>
        <span className="hidden md:inline">Week 08</span>
        <span>Current</span>
      </div>
    </div>
  );
}

function TaxonomyDonut({
  tropicalPct,
  succulentPct,
  fernPct,
  total,
}: {
  tropicalPct: number;
  succulentPct: number;
  fernPct: number;
  total: number;
}) {
  const t1 = tropicalPct * 3.6;
  const t2 = succulentPct * 3.6;
  const t3 = fernPct * 3.6;
  const c1 = "#4A5D45";
  const c2 = "#6B7A63";
  const c3 = "#C5D4B8";

  return (
    <div className="relative flex flex-col items-center">
      <div
        className="relative h-44 w-44 rounded-full sm:h-52 sm:w-52"
        style={{
          background: `conic-gradient(${c1} 0deg ${t1}deg, ${c2} ${t1}deg ${t1 + t2}deg, ${c3} ${t1 + t2}deg ${t1 + t2 + t3}deg)`,
        }}
      >
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-3xl font-bold text-ink">{total}</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
            Plants
          </span>
        </div>
      </div>
      <ul className="mt-6 w-full max-w-xs space-y-2.5 text-sm">
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-forest" />
            Tropicals
          </span>
          <span className="font-semibold text-ink">{tropicalPct}%</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-olive" />
            Succulents
          </span>
          <span className="font-semibold text-ink">{succulentPct}%</span>
        </li>
        <li className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#C5D4B8]" />
            Ferns &amp; mosses
          </span>
          <span className="font-semibold text-ink">{fernPct}%</span>
        </li>
      </ul>
    </div>
  );
}

function MetabolicChart() {
  const maxStack = Math.max(
    ...METABOLIC_BARS.map((b) => b.water + b.nutrients),
    1,
  );
  return (
    <div className="flex h-[180px] items-end justify-between gap-1.5 sm:gap-2">
      {METABOLIC_BARS.map((b, i) => {
        const total = b.water + b.nutrients;
        const hPct = (total / maxStack) * 100;
        const wFrac = b.water / total;
        return (
          <div
            key={i}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <div
              className="flex w-full min-w-0 flex-col overflow-hidden rounded-t-lg ring-1 ring-black/[0.06]"
              style={{
                height: `${Math.max(12, hPct * 0.88)}%`,
              }}
            >
              <div
                className="w-full shrink-0 bg-forest"
                style={{ height: `${wFrac * 100}%` }}
              />
              <div className="min-h-0 w-full flex-1 bg-white" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InsightsPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [rangeLabel, setRangeLabel] = useState("Last 90 days");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [sumRes, plantsRes]: [
        ApiEnvelope<DashboardSummary>,
        ApiEnvelope<{ items: Plant[] }>,
      ] = await Promise.all([
        apiGet<DashboardSummary>("/api/dashboard/summary"),
        apiGet<{ items: Plant[] }>("/api/plants?limit=100&page=1"),
      ]);

      if (!sumRes.success && sumRes.error?.toLowerCase().includes("auth")) {
        router.push("/login");
        return;
      }
      if (!sumRes.success || !sumRes.data) {
        setError(sumRes.error || sumRes.message || "Could not load insights.");
        setLoading(false);
        return;
      }
      setSummary(sumRes.data);
      if (plantsRes.success && plantsRes.data?.items) {
        setPlants(plantsRes.data.items);
      } else {
        setPlants([]);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const taxonomy = useMemo(() => {
    if (plants.length === 0) {
      return { tropical: 45, succulent: 25, fern: 30 };
    }
    let t = 0;
    let s = 0;
    let f = 0;
    for (const p of plants) {
      const c = categorizePlant(p);
      if (c === "succulent") s++;
      else if (c === "fern") f++;
      else t++;
    }
    const n = plants.length;
    const tropical = Math.round((t / n) * 100);
    const succulent = Math.round((s / n) * 100);
    const fern = Math.max(0, 100 - tropical - succulent);
    return { tropical, succulent, fern };
  }, [plants]);

  type MilestoneRow = {
    title: string;
    body: string;
    time: string;
    plant?: Plant;
    kind?: "trophy";
  };

  const milestones = useMemo((): MilestoneRow[] => {
    const acts = summary?.recentActivities ?? [];
    const byPlant = new Map(plants.map((p) => [p._id, p]));
    const fromApi: MilestoneRow[] = acts.slice(0, 3).map((a) => {
      const plant = byPlant.get(a.plantId);
      return {
        ...milestoneFromActivity(a, plant),
        plant,
      };
    });
    if (fromApi.length >= 3) return fromApi;

    const fallbacks: MilestoneRow[] = [
      {
        title: "Monstera grew a new leaf!",
        body: "Recorded in Living Room collection. Development took 12 days.",
        time: "2 HOURS AGO",
      },
      {
        title: "Snake Plant is thriving in the bedroom",
        body: "Current light levels in the Bedroom are optimal for this species.",
        time: "YESTERDAY",
      },
      {
        title: "Perfect streak: 30 days",
        body: "You haven't missed a scheduled watering or check-in all month.",
        time: "3 DAYS AGO",
        kind: "trophy",
      },
    ];
    const merged = [...fromApi];
    for (let i = merged.length; i < 3; i++) {
      merged.push(fallbacks[i]!);
    }
    return merged;
  }, [summary?.recentActivities, plants]);

  const totalPlants = summary?.totalPlants ?? 0;
  const healthy = summary?.healthyPlants ?? 0;
  const healthScore =
    totalPlants === 0
      ? 0
      : Math.round((100 * healthy) / Math.max(totalPlants, 1));
  const speciesN = distinctSpeciesCount(plants);
  const completedWeek = summary?.completedThisWeek ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-care-canvas px-6 py-10 lg:px-10">
        <p className="text-sm text-muted">Loading insights…</p>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="min-h-screen bg-care-canvas px-6 py-10 lg:px-10">
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-care-canvas px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8 max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Collection analysis
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink lg:text-4xl">
          Your conservatory insights
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          A detailed overview of your botanical collection&apos;s vitality, growth
          patterns, and metabolic consistency over the past 30 days.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 pb-16">
        <section className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            icon={<Leaf className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            badge={healthBadge(healthScore)}
            label="Overall health score"
            value={totalPlants === 0 ? "—" : `${healthScore}%`}
          />
          <KpiCard
            icon={
              <TrendingUp className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            }
            badge={growthBadge(completedWeek, totalPlants)}
            label="Growth rate"
            value={growthPercent(completedWeek, totalPlants)}
          />
          <KpiCard
            icon={<Sprout className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            badge={speciesBadge(speciesN, totalPlants)}
            label="Active species"
            value={
              totalPlants === 0
                ? "0 types"
                : `${speciesN} total type${speciesN === 1 ? "" : "s"}`
            }
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <div className="rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] lg:col-span-3 lg:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Collection growth</h2>
                <p className="mt-1 text-sm text-muted">
                  New leaf production and height development (3 months)
                </p>
              </div>
              <label className="sr-only" htmlFor="insights-range">
                Date range
              </label>
              <select
                id="insights-range"
                value={rangeLabel}
                onChange={(e) => setRangeLabel(e.target.value)}
                className="w-full shrink-0 rounded-full border-0 bg-input-deep px-4 py-2.5 text-xs font-semibold text-ink shadow-inner ring-1 ring-black/[0.06] sm:w-auto"
              >
                <option>Last 90 days</option>
                <option>Last 30 days</option>
                <option>Year to date</option>
              </select>
            </div>
            <div className="mt-8">
              <CollectionGrowthChart />
            </div>
          </div>

          <div className="relative rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] lg:col-span-2 lg:p-7">
            <h2 className="text-lg font-bold text-ink">Taxonomy</h2>
            <div className="mt-8 flex justify-center">
              <TaxonomyDonut
                tropicalPct={taxonomy.tropical}
                succulentPct={taxonomy.succulent}
                fernPct={taxonomy.fern}
                total={totalPlants}
              />
            </div>
            <button
              type="button"
              className="absolute bottom-5 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-forest text-white shadow-lg transition hover:bg-olive-dark"
              aria-label="Share insights"
              onClick={async () => {
                try {
                  if (navigator.share) {
                    await navigator.share({
                      title: "BloomIQ insights",
                      text: "Conservatory snapshot from BloomIQ",
                    });
                  }
                } catch {
                  /* dismissed */
                }
              }}
            >
              <Share2 className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[22px] bg-[#EFEAE0] p-6 shadow-sm ring-1 ring-black/[0.05] lg:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">
                  Metabolic consistency
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Watering and fertilization frequency against target.
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-forest" />
                  Water
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-white ring-1 ring-black/15" />
                  Nutrients
                </span>
              </div>
            </div>
            <div className="mt-6">
              <MetabolicChart />
            </div>
            <div className="mt-3 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted">
              <span>Oct 1</span>
              <span>Oct 15</span>
              <span>Oct 30</span>
            </div>
          </div>

          <div className="rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] lg:p-7">
            <h2 className="text-lg font-bold text-ink">Recent milestones</h2>
            <ul className="mt-6 space-y-6">
              {milestones.map((m, i) => {
                const src = m.plant ? plantImageSrc(m.plant) : null;
                const showTrophy = m.kind === "trophy";
                return (
                  <li key={i} className="flex gap-4">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-sage ring-2 ring-white shadow-sm">
                      {src ? (
                        m.plant?.imageUrl?.startsWith("/api/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Image
                            src={src}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        )
                      ) : showTrophy ? (
                        <span className="flex h-full w-full items-center justify-center text-forest">
                          <Trophy className="h-6 w-6" strokeWidth={1.75} />
                        </span>
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-forest">
                          <Leaf className="h-6 w-6" strokeWidth={1.5} />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{m.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {m.body}
                      </p>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        {m.time}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link
              href="/dashboard"
              className="mt-8 inline-block text-sm font-semibold text-forest hover:text-olive-dark"
            >
              View dashboard →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
