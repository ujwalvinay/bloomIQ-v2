"use client";

import {
  Bell,
  Circle,
  Droplets,
  Leaf,
  ListTodo,
  Plus,
  Sprout,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { absoluteApiUrl } from "@/lib/backend-origin";
import { apiGet, apiPatch, apiPost, type ApiEnvelope } from "@/lib/api";
import { PlantSearchCombobox } from "@/components/plants/PlantSearchCombobox";

type SafeUser = {
  _id: string;
  name: string;
  email: string;
  timezone: string;
  avatarUrl: string | null;
  updatedAt?: string;
};

type DashboardSummary = {
  totalPlants: number;
  healthyPlants: number;
  needsAttentionPlants: number;
  tasksDueToday: number;
  overdueTasks: number;
  completedThisWeek: number;
};

type Plant = {
  _id: string;
  name: string;
  species?: string;
  location?: string;
  imageUrl?: string;
  status: string;
  lightLevel?: string;
  careRequirements?: string;
  careGuide?: {
    watering: string;
    sunlight: string;
    fertilizer: string;
    temperature: string;
  };
};

type CarePlan = {
  plantId: string;
  type: string;
  nextDueAt: string;
  isActive: boolean;
};

type TaskDueSlot = "overdue" | "today";

type TaskRow = {
  _id: string;
  plantId: string;
  carePlanId?: string | null;
  type: string;
  title?: string;
  dueAt: string;
  status: string;
  overdue: boolean;
  dueSlot: TaskDueSlot;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function careVerb(type: string): string {
  if (type === "watering") return "Water";
  if (type === "fertilizing") return "Fertilize";
  if (type === "pruning") return "Prune";
  return "Care for";
}

function taskTitle(type: string, plantName: string, customTitle?: string): string {
  if (type === "custom") {
    const t = customTitle?.trim();
    return t && t.length > 0 ? t : "Custom task";
  }
  const v = careVerb(type);
  const plant = plantName || "plant";
  if (type === "watering") return `${v} the ${plant}`;
  return `${v} ${plant}`;
}

function formatDueLine(
  plant: Plant | undefined,
  slot: TaskDueSlot,
  kind: "care" | "custom"
): string {
  const loc = plant?.location?.trim();
  const nm = plant?.name?.trim();
  const when = slot === "overdue" ? "Overdue" : "Due today";
  if (kind === "custom") {
    if (nm && loc) return `${nm} • ${loc} • ${when}`;
    if (nm) return `${nm} • ${when}`;
    return when;
  }
  if (slot === "overdue") {
    return loc ? `${loc} • Overdue` : "Overdue";
  }
  return loc ? `${loc} • Due today` : "Due today";
}

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${y}-${pad(m)}-${pad(day)}`;
}

function daysUntilNextWater(nextDueIso: string): number {
  const due = new Date(nextDueIso).getTime();
  const now = Date.now();
  return Math.ceil((due - now) / 86400000);
}

function wateringLabel(nextDueIso: string | undefined): string {
  if (!nextDueIso) return "—";
  const days = daysUntilNextWater(nextDueIso);
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function growthLabel(status: string): string {
  if (status === "needs_attention") return "Dormant";
  if (status === "archived") return "—";
  return "Active";
}

function sunlightLabel(): string {
  return "Partial";
}

type TaskIconProps = { type: string; className?: string };

function TaskTypeIcon({ type, className }: TaskIconProps) {
  const cn = className ?? "h-5 w-5";
  if (type === "custom")
    return <ListTodo className={cn} strokeWidth={1.75} aria-hidden />;
  if (type === "watering") return <Droplets className={cn} strokeWidth={1.75} aria-hidden />;
  if (type === "fertilizing")
    return <Sprout className={cn} strokeWidth={1.75} aria-hidden />;
  return <Leaf className={cn} strokeWidth={1.75} aria-hidden />;
}

export function DashboardContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [waterPlans, setWaterPlans] = useState<CarePlan[]>([]);
  const [search, setSearch] = useState("");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addPlantId, setAddPlantId] = useState("");
  const [addDueDate, setAddDueDate] = useState(localTodayYmd);
  const [addNotes, setAddNotes] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const addTitleRef = useRef<HTMLInputElement>(null);
  const [careLoggedNotice, setCareLoggedNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [
      meRes,
      summaryRes,
      dueRes,
      plantsRes,
      plansRes,
    ]: [
      ApiEnvelope<SafeUser>,
      ApiEnvelope<DashboardSummary>,
      ApiEnvelope<{
        dueToday: Omit<TaskRow, "overdue" | "dueSlot">[];
        overdue: Omit<TaskRow, "overdue" | "dueSlot">[];
      }>,
      ApiEnvelope<{ items: Plant[] }>,
      ApiEnvelope<CarePlan[]>,
    ] = await Promise.all([
      apiGet<SafeUser>("/api/auth/me"),
      apiGet<DashboardSummary>("/api/dashboard/summary"),
      apiGet<{
        dueToday: Omit<TaskRow, "overdue" | "dueSlot">[];
        overdue: Omit<TaskRow, "overdue" | "dueSlot">[];
      }>("/api/tasks/due-today"),
      apiGet<{ items: Plant[] }>("/api/plants?limit=20&page=1"),
      apiGet<CarePlan[]>("/api/care-plans?isActive=true&type=watering"),
    ]);

    const failed =
      !meRes.success ||
      !summaryRes.success ||
      !dueRes.success ||
      !plantsRes.success ||
      !plansRes.success;
    if (!meRes.success && meRes.error?.toLowerCase().includes("auth")) {
      router.push("/login");
      return;
    }
    if (
      failed ||
      !meRes.data ||
      !summaryRes.data ||
      !dueRes.data ||
      !plantsRes.data ||
      !Array.isArray(plansRes.data)
    ) {
      setError(
        meRes.error ||
          summaryRes.error ||
          dueRes.error ||
          plantsRes.error ||
          plansRes.error ||
          "Could not load dashboard."
      );
      setLoading(false);
      return;
    }

    setUser(meRes.data);
    setSummary(summaryRes.data);
    const overdueRows = (dueRes.data.overdue ?? []).map((t) => ({
      ...t,
      overdue: true,
      dueSlot: "overdue" as const,
    }));
    const todayRows = (dueRes.data.dueToday ?? []).map((t) => ({
      ...t,
      overdue: false,
      dueSlot: "today" as const,
    }));
    setTasks([...overdueRows, ...todayRows]);
    setPlants(plantsRes.data.items);
    setWaterPlans(plansRes.data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const plantById = useMemo(() => {
    const m = new Map<string, Plant>();
    for (const p of plants) m.set(p._id, p);
    return m;
  }, [plants]);

  const waterByPlantId = useMemo(() => {
    const m = new Map<string, CarePlan>();
    for (const w of waterPlans) {
      if (w.type === "watering" && w.isActive) m.set(w.plantId, w);
    }
    return m;
  }, [waterPlans]);

  const filteredTasks = useMemo(() => {
    const open = tasks.filter((t) => t.status === "pending");
    const q = search.trim().toLowerCase();
    if (!q) return open;
    return open.filter((t) => {
      const p = plantById.get(t.plantId);
      const title = taskTitle(t.type, p?.name ?? "", t.title).toLowerCase();
      const custom = t.title?.toLowerCase().includes(q) ?? false;
      return (
        title.includes(q) ||
        custom ||
        (p?.location?.toLowerCase().includes(q) ?? false) ||
        (p?.name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tasks, search, plantById]);

  const featuredPlants = useMemo(() => {
    const active = plants.filter((p) => p.status !== "archived");
    const q = search.trim().toLowerCase();
    const list = q
      ? active.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.species?.toLowerCase().includes(q) ?? false) ||
            (p.location?.toLowerCase().includes(q) ?? false)
        )
      : active;
    return list.slice(0, 2);
  }, [plants, search]);

  const healthyPct =
    summary && summary.totalPlants > 0
      ? Math.round((summary.healthyPlants / summary.totalPlants) * 100)
      : 0;

  async function completeTask(id: string) {
    setCompletingId(id);
    try {
      const res = await apiPatch<{
        type: string;
        nextScheduledDueAt?: string | null;
      }>(`/api/tasks/${id}/complete`, {});
      if (!res.success || !res.data) {
        setError(res.error || res.message);
        return;
      }
      const { type, nextScheduledDueAt } = res.data;
      setTasks((prev) => prev.filter((t) => t._id !== id));
      await load();
      if (type !== "custom") {
        if (nextScheduledDueAt) {
          const when = new Date(nextScheduledDueAt).toLocaleDateString(
            "en-US",
            { month: "short", day: "numeric" }
          );
          setCareLoggedNotice(
            `Care logged. Next round is due ${when}. It will show here again on that day (or earlier if it becomes overdue).`
          );
        } else {
          setCareLoggedNotice(
            "Care logged. Your list was refreshed. If this plant has no active schedule, only the log was updated."
          );
        }
        window.setTimeout(() => setCareLoggedNotice(null), 10000);
      }
    } finally {
      setCompletingId(null);
    }
  }

  const openAddTaskModal = useCallback(() => {
    const first = plants.find((p) => p.status !== "archived")?._id ?? "";
    setAddFormError(null);
    setAddTitle("");
    setAddNotes("");
    setAddDueDate(localTodayYmd());
    setAddPlantId(first);
    setAddTaskOpen(true);
  }, [plants]);

  useEffect(() => {
    if (!addTaskOpen) return;
    const t = window.setTimeout(() => addTitleRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [addTaskOpen]);

  useEffect(() => {
    if (!addTaskOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAddTaskOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addTaskOpen]);

  async function submitCustomTask() {
    const title = addTitle.trim();
    if (!title) {
      setAddFormError("Give this task a short title.");
      return;
    }
    if (!addPlantId) {
      setAddFormError("Add a plant to your conservatory first, then you can attach tasks.");
      return;
    }
    setAddFormError(null);
    setAddSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        plantId: addPlantId,
        title,
        dueDate: addDueDate,
      };
      const notes = addNotes.trim();
      if (notes) body.notes = notes;
      const res = await apiPost<unknown>("/api/tasks", body);
      if (!res.success) {
        setAddFormError(res.error || res.message);
        return;
      }
      setAddTaskOpen(false);
      await load();
    } finally {
      setAddSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-8">
        <p className="text-sm text-muted">Loading your conservatory…</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="p-8 lg:p-10">
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#FAF9F6] pb-12">
      <header className="flex flex-col gap-3 overflow-visible border-b border-stone-200/60 bg-[#FAF9F6]/95 px-4 py-4 backdrop-blur-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-10 lg:py-6">
        {/* Mobile: one row (search + avatar). Desktop (`lg:contents`): search and actions become direct flex children of the header for justify-between. */}
        <div className="flex w-full min-w-0 flex-row items-center gap-3 lg:contents">
          <div className="relative z-20 min-w-0 flex-1 lg:max-w-xl">
            <PlantSearchCombobox
              value={search}
              onChange={setSearch}
              onNavigate={() => setSearch("")}
              placeholder="Search your botanical collection…"
              inputClassName="bg-[#E8E6E0] focus:bg-white focus:ring-2 focus:ring-olive/25"
              debounceMs={280}
            />
          </div>
          <div className="flex shrink-0 items-center justify-end gap-3 lg:gap-5">
            <button
              type="button"
              className="hidden rounded-full p-2 text-muted transition hover:bg-black/[0.04] hover:text-ink lg:inline-flex"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div className="flex items-center gap-3 text-right">
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold text-ink">
                  {user?.name ?? "Grower"}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                  Lead botanist
                </p>
              </div>
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- cookie-auth bytes; bypass rewrite for binary
                <img
                  src={`${absoluteApiUrl(user.avatarUrl)}?v=${encodeURIComponent(user.updatedAt ?? "")}`}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
              ) : (
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D9E8D1] text-sm font-semibold text-olive-cta"
                  aria-hidden
                >
                  {initials(user?.name ?? "?")}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {error ? (
          <p
            className="mb-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">
          Dashboard overview
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Your Conservatory
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[1.25rem] bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
            <p className="text-xs font-medium text-muted">Total plants</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {summary?.totalPlants ?? 0}
            </p>
            {summary && summary.completedThisWeek > 0 ? (
              <p className="mt-2 inline-block rounded-full bg-[#D9E8D1] px-2.5 py-0.5 text-[11px] font-semibold text-olive-cta">
                +{summary.completedThisWeek} completed this week
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">Your living collection</p>
            )}
          </div>
          <div className="rounded-[1.25rem] bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
            <p className="text-xs font-medium text-muted">Healthy</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {summary?.healthyPlants ?? 0}
            </p>
            <p className="mt-2 text-sm text-muted">{healthyPct}%</p>
          </div>
          <div className="rounded-[1.25rem] bg-white p-6 shadow-sm ring-1 ring-stone-200/60">
            <p className="text-xs font-medium text-muted">Attention</p>
            <p className="mt-2 text-3xl font-semibold text-red-600">
              {(summary?.overdueTasks ?? 0) > 0
                ? (summary?.overdueTasks ?? 0)
                : summary?.needsAttentionPlants ?? 0}
            </p>
            <p className="mt-2 text-xs font-semibold text-red-600">Urgent</p>
          </div>
        </div>

        <section className="mt-10 rounded-[1.5rem] bg-[#F3F1EC] p-6 shadow-sm ring-1 ring-stone-200/40 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">
              Due today &amp; overdue
            </h2>
            <span className="rounded-full bg-[#D9E8D1] px-4 py-1.5 text-xs font-semibold text-olive-cta">
              {new Intl.DateTimeFormat("en-US", {
                month: "long",
                day: "numeric",
              }).format(new Date())}
            </span>
          </div>
          {careLoggedNotice ? (
            <p
              className="mt-4 rounded-[1.25rem] bg-[#D9E8D1]/90 px-4 py-3 text-sm font-medium text-olive-cta ring-1 ring-olive-cta/20"
              role="status"
            >
              {careLoggedNotice}
            </p>
          ) : null}
          <ul className="mt-6 flex flex-col gap-3">
            {filteredTasks.length === 0 ? (
              <li className="rounded-[1.25rem] bg-white px-5 py-8 text-center text-sm text-muted ring-1 ring-stone-200/60">
                Nothing due today or overdue. Enjoy a quiet day in the conservatory.
              </li>
            ) : (
              filteredTasks.map((t) => {
                const p = plantById.get(t.plantId);
                const busy = completingId === t._id;
                const isCustom = t.type === "custom";
                const headline = taskTitle(t.type, p?.name ?? "plant", t.title);
                const dueLine = formatDueLine(
                  p,
                  t.dueSlot,
                  isCustom ? "custom" : "care"
                );
                return (
                  <li
                    key={t._id}
                    className="flex flex-col gap-3 rounded-[1.25rem] bg-white px-4 py-4 ring-1 ring-stone-200/60 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                  >
                    <div className="flex items-start gap-3 sm:contents">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void completeTask(t._id)}
                        className="shrink-0 text-olive-cta transition hover:opacity-80 disabled:opacity-40"
                        aria-label={`Mark completed: ${headline}`}
                      >
                        <Circle className="h-6 w-6" strokeWidth={1.75} />
                      </button>
                      <div className="min-w-0 flex-1 sm:order-none">
                        <p className="font-semibold text-ink">
                          {headline}
                        </p>
                        <p className="text-sm text-muted">{dueLine}</p>
                      </div>
                      <div
                        className={`ml-auto shrink-0 rounded-full p-2 sm:ml-0 ${
                          t.type === "fertilizing"
                            ? "bg-stone-100 text-muted"
                            : isCustom
                              ? "bg-amber-50 text-amber-800"
                              : "bg-[#D9E8D1]/80 text-olive-cta"
                        }`}
                      >
                        <TaskTypeIcon type={t.type} />
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          <button
            type="button"
            onClick={openAddTaskModal}
            className="mt-5 flex w-full items-center justify-center rounded-[1.25rem] border-2 border-dashed border-stone-300/80 bg-transparent py-4 text-sm font-medium text-muted transition hover:border-stone-400 hover:text-ink"
          >
            + Add Custom Task
          </button>
        </section>

        {addTaskOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAddTaskOpen(false);
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-custom-task-title"
              className="w-full max-w-md rounded-[1.25rem] bg-white p-6 shadow-lg ring-1 ring-stone-200/80"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="add-custom-task-title"
                  className="text-lg font-semibold text-ink"
                >
                  Add custom task
                </h3>
                <button
                  type="button"
                  onClick={() => setAddTaskOpen(false)}
                  className="rounded-lg p-1 text-muted transition hover:bg-stone-100 hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">
                One-off reminders tied to a plant. They won&apos;t change your care schedules.
              </p>

              {addFormError ? (
                <p className="mt-4 text-sm text-red-700" role="alert">
                  {addFormError}
                </p>
              ) : null}

              <label className="mt-5 block text-xs font-medium text-muted">
                Title
                <input
                  ref={addTitleRef}
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Rotate toward the window"
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none ring-olive-cta/30 transition focus:ring-2"
                />
              </label>

              <label className="mt-4 block text-xs font-medium text-muted">
                Plant
                <select
                  value={addPlantId}
                  onChange={(e) => setAddPlantId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none ring-olive-cta/30 transition focus:ring-2"
                >
                  {plants.filter((p) => p.status !== "archived").length === 0 ? (
                    <option value="">No plants yet</option>
                  ) : (
                    plants
                      .filter((p) => p.status !== "archived")
                      .map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}
                          {p.location ? ` — ${p.location}` : ""}
                        </option>
                      ))
                  )}
                </select>
              </label>

              <label className="mt-4 block text-xs font-medium text-muted">
                Due date
                <input
                  type="date"
                  value={addDueDate}
                  onChange={(e) => setAddDueDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none ring-olive-cta/30 transition focus:ring-2"
                />
              </label>

              <label className="mt-4 block text-xs font-medium text-muted">
                Notes{" "}
                <span className="font-normal text-stone-400">(optional)</span>
                <textarea
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder="Any extra context…"
                  className="mt-1.5 w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-ink outline-none ring-olive-cta/30 transition focus:ring-2"
                />
              </label>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddTaskOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted transition hover:bg-stone-100 hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={addSubmitting}
                  onClick={() => void submitCustomTask()}
                  className="rounded-xl bg-olive-cta px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {addSubmitting ? "Saving…" : "Add task"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Featured Plants</h2>
            <Link
              href="/plants"
              className="text-sm font-semibold text-olive-cta underline-offset-4 hover:underline"
            >
              View All Members
            </Link>
          </div>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredPlants.map((plant) => {
              const plan = waterByPlantId.get(plant._id);
              const wLabel = wateringLabel(plan?.nextDueAt);
              const isDry =
                plant.status === "needs_attention" || wLabel === "Overdue";
              return (
                <article
                  key={plant._id}
                  className="flex flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-sm ring-1 ring-stone-200/60"
                >
                  <div className="relative aspect-[4/3] bg-stone-200">
                    {plant.imageUrl ? (
                      plant.imageUrl.startsWith("/api/plants/") ? (
                        // eslint-disable-next-line @next/next/no-img-element -- cookie-auth bytes; bypass rewrite for binary
                        <img
                          src={absoluteApiUrl(plant.imageUrl)}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <Image
                          src={plant.imageUrl}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 100vw, 33vw"
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted">
                        <Sprout className="h-14 w-14" strokeWidth={1.25} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-ink">{plant.name}</h3>
                        {plant.species ? (
                          <p className="text-sm italic text-muted">{plant.species}</p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                          isDry
                            ? "bg-red-50 text-red-700"
                            : "bg-[#D9E8D1] text-olive-cta"
                        }`}
                      >
                        {isDry ? "Dry soil" : "Optimal"}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-center">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Watering
                        </p>
                        <p
                          className={`mt-1 text-xs font-medium ${
                            wLabel === "Overdue" ? "text-red-600" : "text-ink"
                          }`}
                        >
                          {wLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Sunlight
                        </p>
                        <p className="mt-1 text-xs font-medium text-ink">
                          {sunlightLabel()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          Growth
                        </p>
                        <p className="mt-1 text-xs font-medium text-ink">
                          {growthLabel(plant.status)}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            <Link
              href="/plants/add"
              className="flex min-h-[280px] flex-col items-center justify-center rounded-[1.25rem] border-2 border-dashed border-stone-300/80 bg-white/50 px-6 text-center transition hover:border-stone-400 hover:bg-white"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-200/80 text-muted">
                <Plus className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <p className="mt-4 font-semibold text-ink">Add New Plant</p>
              <p className="mt-1 text-sm text-muted">Expand your conservatory</p>
            </Link>
          </div>
        </section>

        <section className="mt-10 overflow-hidden rounded-[1.5rem] bg-[#D9E8D1] px-6 py-8 lg:flex lg:items-center lg:justify-between lg:px-10 lg:py-10">
          <div className="max-w-lg">
            <h2 className="text-xl font-semibold text-ink lg:text-2xl">
              Expand your garden knowledge
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink/80">
              Browse care guides, species notes, and seasonal tips in the BloomIQ
              botanical library—curated to help every plant in your conservatory
              thrive.
            </p>
            <Link
              href="/help"
              className="mt-6 inline-flex rounded-full bg-olive-cta px-6 py-3 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-olive-cta/90"
            >
              Browse Library
            </Link>
          </div>
          <div
            className="relative mx-auto mt-8 h-36 w-36 shrink-0 rounded-full bg-white/40 lg:mx-0 lg:mt-0 lg:h-44 lg:w-44"
            aria-hidden
          >
            <div className="absolute inset-3 rounded-full bg-[#c5d9b8]/90" />
            <Leaf className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 text-olive-cta/90 lg:h-20 lg:w-20" strokeWidth={1.25} />
          </div>
        </section>
      </main>
    </div>
  );
}
