"use client";

import {
  Bell,
  Camera,
  Droplets,
  Heart,
  Leaf,
  Plus,
  Search,
  Sun,
  Thermometer,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { absoluteApiUrl } from "@/lib/backend-origin";
import { apiGet, apiPatch, apiPost, type ApiEnvelope } from "@/lib/api";

type SafeUser = { _id: string; name: string; email: string };

type Plant = {
  _id: string;
  name: string;
  species?: string;
  location?: string;
  imageUrl?: string;
  notes?: string;
  status: string;
  createdAt?: string;
};

type CarePlan = {
  plantId: string;
  type: string;
  nextDueAt: string;
  isActive: boolean;
};

type Activity = {
  _id: string;
  action: string;
  date: string;
  notes?: string;
};

type TaskRow = {
  _id: string;
  plantId: string;
  type: string;
  status: string;
};

type ActivitiesPayload = {
  items: Activity[];
  page: number;
  totalPages: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function specimenCode(plant: Plant): string {
  const created = plant.createdAt ? new Date(plant.createdAt) : new Date();
  const y = created.getFullYear();
  const m = String(created.getMonth() + 1).padStart(2, "0");
  const prefix = plant.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase() || "SPM";
  return `#${prefix}-${y}-${m}`;
}

function lightLevel(location?: string): string {
  if (!location) return "Bright indirect";
  const l = location.toLowerCase();
  if (l.includes("kitchen") || l.includes("office")) return "Bright indirect";
  if (l.includes("bathroom")) return "Low / indirect";
  if (l.includes("garden") || l.includes("courtyard")) return "Direct sun";
  if (l.includes("bedroom") || l.includes("living")) return "Bright indirect";
  return "Bright indirect";
}

function healthHeadline(status: string): string {
  if (status === "archived") return "Archived";
  if (status === "needs_attention") return "Needs attention";
  return "Thriving";
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function wateringSummary(nextDueIso: string | undefined): string {
  if (!nextDueIso) return "No schedule";
  const d = daysUntil(nextDueIso);
  if (d < 0) return "Overdue";
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  return `In ${d} days`;
}

function careTips(species?: string, name?: string): {
  watering: string;
  sunlight: string;
  fertilizer: string;
  temperature: string;
} {
  const s = `${species ?? ""} ${name ?? ""}`.toLowerCase();
  if (s.includes("fiddle") || s.includes("ficus") || s.includes("lyrata")) {
    return {
      watering:
        "Allow top 2 inches of soil to dry out between waterings. Use lukewarm filtered water.",
      sunlight:
        "Place in front of an east-facing window. Rotate monthly for even growth.",
      fertilizer:
        "Feed once a month during spring and summer with organic leaf-heavy food.",
      temperature:
        "Maintain between 65°F – 75°F. Keep away from air conditioning drafts.",
    };
  }
  if (s.includes("monstera")) {
    return {
      watering:
        "Water when the top few inches of soil feel dry; avoid soggy roots.",
      sunlight:
        "Bright, indirect light; a few hours of gentle morning sun is welcome.",
      fertilizer:
        "Balanced liquid fertilizer every 4–6 weeks in the growing season.",
      temperature:
        "Prefers 65°F – 80°F; protect from cold drafts below 55°F.",
    };
  }
  if (s.includes("snake") || s.includes("sansevieria") || s.includes("dracaena")) {
    return {
      watering:
        "Water sparingly; let soil dry completely between deep drinks.",
      sunlight:
        "Tolerates low light; brighter indirect light speeds growth.",
      fertilizer:
        "Light feeding once in spring and once in summer is plenty.",
      temperature:
        "Average room temperatures; avoid frost and wet feet in winter.",
    };
  }
  return {
    watering:
      "Water when the top inch of soil dries; empty drainage trays after watering.",
    sunlight:
      "Bright indirect light suits most houseplants; avoid harsh midday sun.",
    fertilizer:
      "Use a balanced houseplant food every 4–8 weeks while actively growing.",
    temperature:
      "Most specimens prefer 65°F – 78°F away from heaters and cold windows.",
  };
}

function activityHeadline(a: Activity): string {
  switch (a.action) {
    case "watered":
      return "Watered";
    case "fertilized":
      return "Fertilized";
    case "pruned":
      return "Pruned";
    case "note_added":
      return a.notes?.split("\n")[0]?.slice(0, 48) || "Note added";
    case "task_skipped":
      return "Task skipped";
    case "task_snoozed":
      return "Task snoozed";
    default:
      return "Care event";
  }
}

function activityBlurb(a: Activity): string {
  if (a.notes?.trim()) return a.notes.trim();
  switch (a.action) {
    case "watered":
      return "Recorded in your conservatory log.";
    case "fertilized":
      return "Nutrients added to support steady growth.";
    default:
      return "Logged in your botanical archive.";
  }
}

function healthSeries(status: string, seed: string): number[] {
  const base =
    status === "healthy" ? 90 : status === "needs_attention" ? 74 : 62;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: 6 }, (_, i) => {
    const pseudo = ((h + i * 17) % 11) - 5;
    const wave = Math.sin(i * 0.75) * 5;
    return Math.min(100, Math.max(52, Math.round(base + wave + pseudo)));
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(file);
  });
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN"] as const;

export function PlantDetailContent({ plantId }: { plantId: string }) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [plant, setPlant] = useState<Plant | null>(null);
  const [waterPlan, setWaterPlan] = useState<CarePlan | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityPageLoaded, setActivityPageLoaded] = useState(1);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [pendingWaterTask, setPendingWaterTask] = useState<TaskRow | null>(null);
  const [busyWater, setBusyWater] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const [
      meRes,
      plantRes,
      plansRes,
      actRes,
      tasksRes,
    ]: [
      ApiEnvelope<SafeUser>,
      ApiEnvelope<Plant>,
      ApiEnvelope<CarePlan[]>,
      ApiEnvelope<ActivitiesPayload>,
      ApiEnvelope<{ items: TaskRow[] }>,
    ] = await Promise.all([
      apiGet<SafeUser>("/api/auth/me"),
      apiGet<Plant>(`/api/plants/${plantId}`),
      apiGet<CarePlan[]>(
        `/api/care-plans?plantId=${encodeURIComponent(plantId)}&isActive=true&type=watering`
      ),
      apiGet<ActivitiesPayload>(
        `/api/activities?plantId=${encodeURIComponent(plantId)}&limit=8&page=1`
      ),
      apiGet<{ items: TaskRow[] }>(
        `/api/tasks?plantId=${encodeURIComponent(plantId)}&type=watering&status=pending&limit=5`
      ),
    ]);

    if (!meRes.success && meRes.error?.toLowerCase().includes("auth")) {
      router.push("/login");
      return;
    }
    if (!plantRes.success || !plantRes.data) {
      setError(plantRes.error || plantRes.message || "Plant not found.");
      setLoading(false);
      return;
    }
    if (!meRes.success || !meRes.data) {
      setError(meRes.error || "Could not load profile.");
      setLoading(false);
      return;
    }

    const plans = Array.isArray(plansRes.data) ? plansRes.data : [];
    const water = plans.find((p) => p.type === "watering" && p.isActive) ?? null;

    const actPayload = actRes.success && actRes.data ? actRes.data : null;
    const taskItems =
      tasksRes.success && tasksRes.data?.items ? tasksRes.data.items : [];

    setUser(meRes.data);
    setPlant(plantRes.data);
    setWaterPlan(water);
    setActivities(actPayload?.items ?? []);
    setActivityPageLoaded(1);
    setActivityTotalPages(actPayload?.totalPages ?? 1);
    setPendingWaterTask(
      taskItems.find((t) => t.type === "watering" && t.status === "pending") ??
        null
    );
    setLoading(false);
  }, [plantId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const tips = useMemo(
    () => careTips(plant?.species, plant?.name),
    [plant?.species, plant?.name]
  );

  const series = useMemo(
    () => healthSeries(plant?.status ?? "healthy", plant?._id ?? "x"),
    [plant?.status, plant?._id]
  );
  const avgScore = useMemo(
    () => Math.round(series.reduce((a, b) => a + b, 0) / series.length),
    [series]
  );

  const chartPath = useMemo(() => {
    const w = 400;
    const h = 112;
    const pad = 8;
    const min = Math.min(...series) - 6;
    const max = Math.max(...series) + 6;
    const span = max - min || 1;
    const pts = series.map((v, i) => {
      const x = pad + (i / (series.length - 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  }, [series]);

  const imgSrc = useMemo(() => {
    if (!plant?.imageUrl) return null;
    return plant.imageUrl.startsWith("/api/plants/")
      ? absoluteApiUrl(plant.imageUrl)
      : plant.imageUrl;
  }, [plant?.imageUrl]);

  async function markWatered() {
    if (!plant) return;
    setBusyWater(true);
    setError(null);
    try {
      if (pendingWaterTask) {
        const res = await apiPatch<unknown>(
          `/api/tasks/${pendingWaterTask._id}/complete`,
          {}
        );
        if (!res.success) {
          setError(res.error || res.message);
          return;
        }
      } else {
        const res = await apiPost<unknown>("/api/activities", {
          plantId: plant._id,
          action: "watered",
        });
        if (!res.success) {
          setError(res.error || res.message);
          return;
        }
      }
      await load();
    } finally {
      setBusyWater(false);
    }
  }

  async function submitNote() {
    if (!plant || !noteText.trim()) return;
    setNoteBusy(true);
    setError(null);
    try {
      const res = await apiPost<unknown>("/api/activities", {
        plantId: plant._id,
        action: "note_added",
        notes: noteText.trim(),
      });
      if (!res.success) {
        setError(res.error || res.message);
        return;
      }
      setNoteText("");
      setNoteOpen(false);
      await load();
    } finally {
      setNoteBusy(false);
    }
  }

  async function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/") || !plant) return;
    setBusyPhoto(true);
    setError(null);
    try {
      const imageBase64 = await readFileAsBase64(file);
      const res = await apiPatch<Plant>(`/api/plants/${plant._id}`, {
        imageBase64,
        imageMimeType: file.type || "application/octet-stream",
      });
      if (!res.success || !res.data) {
        setError(res.error || res.message);
        return;
      }
      setPlant(res.data);
    } finally {
      setBusyPhoto(false);
    }
  }

  async function loadMoreHistory() {
    const next = activityPageLoaded + 1;
    if (next > activityTotalPages) return;
    const actRes = await apiGet<ActivitiesPayload>(
      `/api/activities?plantId=${encodeURIComponent(plantId)}&limit=8&page=${next}`
    );
    if (actRes.success && actRes.data?.items?.length) {
      setActivities((prev) => [...prev, ...actRes.data!.items]);
      setActivityPageLoaded(next);
    }
  }

  /** Reset list when page increments from "load more" — avoid duplicate logic: simpler to refetch all on load more click */

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

  const archiveLabel =
    plant.status === "archived" ? "Archived specimen" : "Living specimen";

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
            aria-label="Archive sections"
          >
            <a
              href="#overview"
              className="border-b-2 border-transparent pb-1 text-ink/70 transition hover:text-forest"
            >
              Overview
            </a>
            <a
              href="#care-log"
              className="border-b-2 border-forest pb-1 text-forest"
            >
              Care Log
            </a>
            <a
              href="#gallery"
              className="border-b-2 border-transparent pb-1 text-ink/70 transition hover:text-forest"
            >
              Gallery
            </a>
            <a
              href="#history"
              className="border-b-2 border-transparent pb-1 text-ink/70 transition hover:text-forest"
            >
              History
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full p-2 text-muted transition hover:bg-black/[0.04] hover:text-ink"
              aria-label="Search"
            >
              <Search className="h-5 w-5" strokeWidth={1.75} />
            </button>
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
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-alert" role="alert">
            {error}
          </p>
        </div>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <section
          id="overview"
          className="scroll-mt-28 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:gap-x-12"
        >
          <div id="gallery" className="scroll-mt-28">
            <div className="relative aspect-[3/4] max-h-[520px] overflow-hidden rounded-[1.5rem] bg-stone-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-stone-200/60">
              {imgSrc ? (
                plant.imageUrl?.startsWith("/api/plants/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
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
                    sizes="(max-width: 1024px) 100vw, 45vw"
                  />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center text-forest/25">
                  <Leaf className="h-24 w-24" strokeWidth={1} />
                </div>
              )}
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 justify-center">
                <span className="rounded-full bg-forest px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-md">
                  Specimen ID: {specimenCode(plant)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-center lg:mt-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-muted">
              <span className="uppercase">{archiveLabel}</span>
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-forest lg:text-[2.75rem]">
              {plant.name}
            </h1>
            {plant.species ? (
              <p className="mt-2 text-lg italic text-muted">{plant.species}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busyWater}
                onClick={() => void markWatered()}
                className="inline-flex items-center gap-2 rounded-full bg-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest/90 disabled:opacity-50"
              >
                <Droplets className="h-5 w-5" strokeWidth={2} aria-hidden />
                {busyWater ? "Saving…" : "Mark as watered"}
              </button>
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-archive-sage px-6 py-3 text-sm font-semibold text-forest ring-1 ring-forest/10 transition hover:bg-archive-sage/90"
              >
                <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
                Add note
              </button>
            </div>
          </div>
        </section>

        <section className="mt-10 scroll-mt-28">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
            <div className="grid flex-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-4 rounded-[1.25rem] bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] ring-1 ring-stone-200/50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-archive-sage/80 text-forest">
                  <Droplets className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Next watering
                  </p>
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {wateringSummary(waterPlan?.nextDueAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-[1.25rem] bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] ring-1 ring-stone-200/50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-archive-sage/80 text-forest">
                  <Sun className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Light level
                  </p>
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {lightLevel(plant.location)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-[1.25rem] bg-white p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] ring-1 ring-stone-200/50">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-archive-sage/80 text-forest">
                  <Heart className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Current health
                  </p>
                  <p className="mt-1 text-lg font-semibold text-ink">
                    {healthHeadline(plant.status)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end lg:flex-col lg:justify-center">
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void onPhotoPick(e)}
              />
              <button
                type="button"
                disabled={busyPhoto}
                onClick={() => cameraRef.current?.click()}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-md transition hover:bg-ink/85 disabled:opacity-50"
                aria-label="Update portrait"
              >
                <Camera className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </section>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_320px] lg:gap-10">
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-ink">Care requirements</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {(
                  [
                    {
                      title: "Watering",
                      body: tips.watering,
                      icon: Droplets,
                    },
                    { title: "Sunlight", body: tips.sunlight, icon: Sun },
                    {
                      title: "Fertilizer",
                      body: tips.fertilizer,
                      icon: Leaf,
                    },
                    {
                      title: "Temperature",
                      body: tips.temperature,
                      icon: Thermometer,
                    },
                  ] as const
                ).map(({ title, body, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-[1.25rem] bg-white/80 p-5 shadow-sm ring-1 ring-stone-200/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-forest">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-ink">{title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-muted">
                          {body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="history" className="scroll-mt-28">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Health history</h2>
                  <p className="mt-1 text-sm text-muted">
                    Stability and vitality over 6 months
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-semibold tabular-nums text-forest">
                    {avgScore}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Avg. score
                  </p>
                </div>
              </div>
              <div className="mt-6 rounded-[1.25rem] bg-white p-6 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] ring-1 ring-stone-200/50">
                <svg
                  viewBox="0 0 400 120"
                  className="h-40 w-full"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <defs>
                    <linearGradient id="healthFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4A5D45" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#4A5D45" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`${chartPath} L 392 104 L 8 104 Z`}
                    fill="url(#healthFill)"
                  />
                  <path
                    d={chartPath}
                    fill="none"
                    stroke="#4A5D45"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="mt-2 flex justify-between px-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                  {MONTHS.map((m) => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside id="care-log" className="scroll-mt-28 lg:self-start">
            <div className="rounded-[1.5rem] bg-white p-6 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.1)] ring-1 ring-stone-200/50 lg:sticky lg:top-28">
              <h2 className="text-lg font-semibold text-ink">Growth archive</h2>
              <ol className="relative mt-6 space-y-0 pl-2">
                <span
                  className="absolute left-[7px] top-2 bottom-8 w-px bg-stone-200"
                  aria-hidden
                />
                {activities.length === 0 ? (
                  <li className="relative pb-8 pl-8 text-sm text-muted">
                    No log entries yet. Water or add a note to begin the archive.
                  </li>
                ) : (
                  activities.map((a, i) => (
                    <li key={a._id} className="relative pb-8 pl-8 last:pb-0">
                      <span className="absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-forest bg-archive-cream" />
                      <time
                        dateTime={a.date}
                        className="text-xs font-medium text-muted"
                      >
                        {new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(a.date))}
                      </time>
                      <p className="mt-1 font-semibold text-ink">
                        {activityHeadline(a)}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {activityBlurb(a)}
                      </p>
                    </li>
                  ))
                )}
              </ol>
              <button
                type="button"
                disabled={activityPageLoaded >= activityTotalPages}
                onClick={() => void loadMoreHistory()}
                className="mt-4 w-full rounded-[1rem] border-2 border-stone-200/80 py-3 text-xs font-bold uppercase tracking-[0.15em] text-forest transition hover:border-forest/40 hover:bg-archive-sage/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                View full history
              </button>
            </div>
          </aside>
        </div>

        <p className="mt-10 text-center">
          <Link
            href="/plants"
            className="text-sm font-semibold text-forest underline-offset-4 hover:underline"
          >
            ← Back to My Plants
          </Link>
        </p>
      </div>

      {noteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-dialog-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="note-dialog-title" className="text-lg font-semibold text-ink">
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
