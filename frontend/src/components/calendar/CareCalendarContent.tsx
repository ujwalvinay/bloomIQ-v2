"use client";

import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Leaf,
  ListTodo,
  Sprout,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch } from "@/lib/api";

type ViewMode = "month" | "week";

type TaskKind = "water" | "nutrient" | "soil" | "custom";

type DayMarks = {
  scheduledTypes: string[];
  completedTypes: string[];
};

type GridTaskDot = {
  id: string;
  kind: TaskKind;
  variant: "scheduled" | "completed";
};

type ApiCalendarTaskRow = {
  _id: string;
  type: string;
  displayTitle: string;
  plantLine: string;
  status: string;
  dueAt: string;
  completedAt: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = key.split("-");
  return {
    y: Number(ys),
    m: Number(ms) - 1,
    d: Number(ds),
  };
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function startOfWeekSunday(y: number, m: number, d: number): Date {
  const dt = new Date(y, m, d);
  const dow = dt.getDay();
  dt.setDate(dt.getDate() - dow);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function formatMonthYear(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatSelectedHeading(key: string): string {
  const { y, m, d } = parseKey(key);
  const dt = new Date(y, m, d);
  const weekday = dt.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${pad2(d)}`;
}

function typeToKind(t: string): TaskKind {
  if (t === "watering") return "water";
  if (t === "fertilizing") return "nutrient";
  if (t === "pruning") return "soil";
  return "custom";
}

function marksToDots(key: string, marks?: DayMarks): GridTaskDot[] {
  if (!marks) return [];
  const out: GridTaskDot[] = [];
  let i = 0;
  for (const t of marks.scheduledTypes) {
    out.push({
      id: `${key}-s-${i}`,
      kind: typeToKind(t),
      variant: "scheduled",
    });
    i += 1;
  }
  for (const t of marks.completedTypes) {
    out.push({
      id: `${key}-c-${i}`,
      kind: typeToKind(t),
      variant: "completed",
    });
    i += 1;
  }
  return out;
}

function CellTaskIcon({
  kind,
  className,
}: {
  kind: TaskKind;
  className?: string;
}) {
  const cn = className ?? "h-3.5 w-3.5";
  if (kind === "water")
    return <Droplets className={cn} strokeWidth={2} aria-hidden />;
  if (kind === "nutrient")
    return <Leaf className={cn} strokeWidth={2} aria-hidden />;
  if (kind === "custom")
    return <ListTodo className={cn} strokeWidth={2} aria-hidden />;
  return <Sprout className={cn} strokeWidth={2} aria-hidden />;
}

function TaskIconBadge({ kind }: { kind: TaskKind }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage/80 text-forest">
      <CellTaskIcon kind={kind} className="h-4 w-4" />
    </span>
  );
}

function rowKind(type: string): TaskKind {
  return typeToKind(type);
}

export function CareCalendarContent() {
  const router = useRouter();
  const today = useMemo(() => {
    const n = new Date();
    return toKey(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [visibleY, setVisibleY] = useState(() => new Date().getFullYear());
  const [visibleM, setVisibleM] = useState(() => new Date().getMonth());
  const [selectedKey, setSelectedKey] = useState(today);

  const [rangeMarks, setRangeMarks] = useState<Record<string, DayMarks>>({});
  const [rangeLoading, setRangeLoading] = useState(true);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [scheduledRows, setScheduledRows] = useState<ApiCalendarTaskRow[]>([]);
  const [completedRows, setCompletedRows] = useState<ApiCalendarTaskRow[]>([]);
  const [dayLoading, setDayLoading] = useState(true);
  const [dayError, setDayError] = useState<string | null>(null);

  const [completingId, setCompletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiGet<{ _id: string }>("/api/auth/me");
      if (cancelled) return;
      if (!res.success || !res.data) {
        router.push("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadRange = useCallback(async () => {
    let from: string;
    let to: string;
    if (viewMode === "week") {
      const { y, m, d } = parseKey(selectedKey);
      const start = startOfWeekSunday(y, m, d);
      const end = addDays(start, 6);
      from = toKey(start.getFullYear(), start.getMonth(), start.getDate());
      to = toKey(end.getFullYear(), end.getMonth(), end.getDate());
    } else {
      const first = `${visibleY}-${pad2(visibleM + 1)}-01`;
      const lastD = new Date(visibleY, visibleM + 1, 0).getDate();
      const last = `${visibleY}-${pad2(visibleM + 1)}-${pad2(lastD)}`;
      from = first;
      to = last;
    }

    setRangeLoading(true);
    setRangeError(null);
    const res = await apiGet<{
      days: Record<string, DayMarks>;
    }>(
      `/api/tasks/calendar-range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    setRangeLoading(false);
    if (!res.success || !res.data) {
      setRangeError(res.error || res.message || "Could not load calendar.");
      setRangeMarks({});
      return;
    }
    setRangeMarks(res.data.days ?? {});
  }, [viewMode, visibleY, visibleM, selectedKey]);

  const loadDay = useCallback(async () => {
    setDayLoading(true);
    setDayError(null);
    const res = await apiGet<{
      scheduled: ApiCalendarTaskRow[];
      completed: ApiCalendarTaskRow[];
    }>(`/api/tasks/calendar-day?date=${encodeURIComponent(selectedKey)}`);
    setDayLoading(false);
    if (!res.success || !res.data) {
      setDayError(res.error || res.message || "Could not load this day.");
      setScheduledRows([]);
      setCompletedRows([]);
      return;
    }
    setScheduledRows(res.data.scheduled ?? []);
    setCompletedRows(res.data.completed ?? []);
  }, [selectedKey]);

  useEffect(() => {
    void loadRange();
  }, [loadRange]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const monthCells = useMemo(() => {
    const firstDow = new Date(visibleY, visibleM, 1).getDay();
    const dim = daysInMonth(visibleY, visibleM);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= dim; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [visibleY, visibleM]);

  const weekDays = useMemo(() => {
    const { y, m, d } = parseKey(selectedKey);
    const start = startOfWeekSunday(y, m, d);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedKey]);

  const goPrevMonth = useCallback(() => {
    setVisibleM((prevM) => {
      if (prevM === 0) {
        setVisibleY((y) => y - 1);
        return 11;
      }
      return prevM - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setVisibleM((prevM) => {
      if (prevM === 11) {
        setVisibleY((y) => y + 1);
        return 0;
      }
      return prevM + 1;
    });
  }, []);

  async function completeScheduledTask(id: string) {
    setCompletingId(id);
    try {
      const res = await apiPatch<unknown>(`/api/tasks/${id}/complete`, {});
      if (!res.success) {
        setDayError(res.error || res.message || "Could not complete task.");
        return;
      }
      await Promise.all([loadRange(), loadDay()]);
    } finally {
      setCompletingId(null);
    }
  }

  const scheduledCount = scheduledRows.length;
  const completedCount = completedRows.length;

  return (
    <div className="flex h-full min-h-0 w-full max-w-none flex-1 flex-col overflow-hidden bg-care-canvas px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <header className="mb-4 shrink-0 lg:mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Monthly schedule
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Care calendar
        </h1>
      </header>

      {(rangeError || dayError) && (
        <p
          className="mb-4 shrink-0 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 lg:mb-6"
          role="alert"
        >
          {rangeError || dayError}
        </p>
      )}

      <div className="flex min-h-0 w-full max-w-none flex-1 flex-col gap-6 overflow-hidden xl:flex-row xl:items-stretch xl:gap-8">
        <section className="flex max-h-[min(560px,62vh)] min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-[22px] bg-white p-4 shadow-soft sm:max-h-[min(520px,50vh)] sm:p-7 xl:h-full xl:max-h-none xl:min-w-0 xl:shrink xl:flex-1">
          <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-ink">
                {formatMonthYear(visibleY, visibleM)}
              </h2>
              <div className="flex items-center rounded-full border border-black/[0.06] bg-care-canvas/80 p-0.5">
                <button
                  type="button"
                  onClick={goPrevMonth}
                  className="rounded-full p-2 text-muted transition hover:bg-white hover:text-ink"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={goNextMonth}
                  className="rounded-full p-2 text-muted transition hover:bg-white hover:text-ink"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            <div
              className="inline-flex rounded-full bg-care-canvas p-1 shadow-inner"
              role="group"
              aria-label="Calendar view"
            >
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  viewMode === "month"
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  viewMode === "week"
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                Week
              </button>
            </div>
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5 sm:mt-6">
          {rangeLoading ? (
            <p className="py-8 text-center text-sm text-muted">
              Loading calendar…
            </p>
          ) : null}

          <div className="grid grid-cols-7 gap-y-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-muted sm:gap-y-1 sm:text-[10px]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="truncate py-1.5 sm:py-2">
                {d}
              </div>
            ))}
          </div>

          {viewMode === "month" ? (
            <div className="mt-1 grid grid-cols-7 gap-0.5 sm:gap-2">
              {monthCells.map((day, idx) => {
                if (day === null) {
                  return (
                    <div key={`e-${idx}`} className="min-h-[56px] sm:min-h-[88px]" />
                  );
                }
                const key = toKey(visibleY, visibleM, day);
                const dots = marksToDots(key, rangeMarks[key]);
                const selected = key === selectedKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={`flex min-h-[56px] flex-col rounded-xl border p-1.5 text-left transition sm:min-h-[88px] sm:rounded-2xl sm:p-2 ${
                      selected
                        ? "border-forest bg-sage/70 shadow-sm"
                        : "border-transparent bg-care-canvas/40 hover:bg-care-canvas"
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold sm:text-sm ${
                        selected ? "text-forest" : "text-ink"
                      }`}
                    >
                      {day}
                    </span>
                    {dots.length > 0 && (
                      <div className="mt-auto flex flex-wrap justify-end gap-1 pt-1 text-forest">
                        {dots.slice(0, 4).map((dot) => (
                          <span
                            key={dot.id}
                            className={`flex h-5 w-5 items-center justify-center rounded-full shadow-sm sm:h-6 sm:w-6 ${
                              dot.variant === "completed"
                                ? "bg-white/60 text-forest/70 ring-1 ring-forest/20"
                                : "bg-white/90 text-forest"
                            }`}
                            title={
                              dot.variant === "completed"
                                ? "Completed"
                                : "Scheduled"
                            }
                          >
                            <CellTaskIcon
                              kind={dot.kind}
                              className="h-2.5 w-2.5 sm:h-3 sm:w-3"
                            />
                          </span>
                        ))}
                        {dots.length > 4 && (
                          <span className="text-[10px] font-bold text-muted">
                            +{dots.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-7 gap-0.5 sm:gap-2">
              {weekDays.map((dt) => {
                const y = dt.getFullYear();
                const m = dt.getMonth();
                const d = dt.getDate();
                const key = toKey(y, m, d);
                const dots = marksToDots(key, rangeMarks[key]);
                const selected = key === selectedKey;
                const inVisibleMonth = m === visibleM && y === visibleY;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedKey(key);
                      setVisibleY(y);
                      setVisibleM(m);
                    }}
                    className={`flex min-h-[72px] flex-col rounded-xl border p-1.5 text-left transition sm:min-h-[100px] sm:rounded-2xl sm:p-2 ${
                      selected
                        ? "border-forest bg-sage/70 shadow-sm"
                        : "border-transparent bg-care-canvas/40 hover:bg-care-canvas"
                    } ${!inVisibleMonth ? "opacity-80" : ""}`}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {WEEKDAYS[dt.getDay()]}
                    </span>
                    <span
                      className={`text-sm font-semibold ${
                        selected ? "text-forest" : "text-ink"
                      }`}
                    >
                      {d}
                    </span>
                    {dots.length > 0 && (
                      <div className="mt-auto flex flex-wrap justify-end gap-1 pt-1 text-forest">
                        {dots.slice(0, 4).map((dot) => (
                          <span
                            key={dot.id}
                            className={`flex h-6 w-6 items-center justify-center rounded-full shadow-sm ${
                              dot.variant === "completed"
                                ? "bg-white/60 text-forest/70 ring-1 ring-forest/20"
                                : "bg-white/90 text-forest"
                            }`}
                          >
                            <CellTaskIcon kind={dot.kind} className="h-3 w-3" />
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          </div>
        </section>

        <aside className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden xl:h-full xl:min-w-0 xl:shrink xl:flex-1">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden pr-1 pb-2">
          <div className="rounded-[22px] bg-forest px-6 py-6 text-white shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Selected day
            </p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-2xl font-bold leading-tight">
                {formatSelectedHeading(selectedKey)}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-medium text-white/90">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </span>
                <span>
                  {scheduledCount} open
                </span>
              </span>
              <span className="text-white/50">·</span>
              <span>{completedCount} done</span>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Scheduled
            </p>
            {dayLoading ? (
              <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-8 text-center text-sm text-muted">
                Loading tasks…
              </p>
            ) : (
              <ul className="space-y-3">
                {scheduledRows.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-8 text-center text-sm text-muted">
                    No scheduled tasks on this day.
                  </li>
                ) : (
                  scheduledRows.map((task) => {
                    const busy = completingId === task._id;
                    return (
                      <li
                        key={task._id}
                        className="rounded-[18px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04]"
                      >
                        <div className="flex gap-3">
                          <TaskIconBadge kind={rowKind(task.type)} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-ink">
                              {task.displayTitle}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                              {task.plantLine}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void completeScheduledTask(task._id)}
                          className="mt-4 text-left text-xs font-semibold uppercase tracking-wide text-forest transition hover:text-olive-dark disabled:opacity-40"
                        >
                          {busy ? "Saving…" : "Mark as done →"}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Completed
            </p>
            {dayLoading ? (
              <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-8 text-center text-sm text-muted">
                Loading…
              </p>
            ) : (
              <ul className="space-y-3">
                {completedRows.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-8 text-center text-sm text-muted">
                    Nothing completed on this day yet.
                  </li>
                ) : (
                  completedRows.map((task) => (
                    <li
                      key={task._id}
                      className="rounded-[18px] bg-white p-4 opacity-95 shadow-sm ring-1 ring-black/[0.04]"
                    >
                      <div className="flex gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage/40 text-forest">
                          <CheckCircle2
                            className="h-4 w-4"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink">
                            {task.displayTitle}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {task.plantLine}
                          </p>
                          {task.completedAt ? (
                            <p className="mt-2 text-xs text-muted">
                              Logged{" "}
                              {new Date(task.completedAt).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className="rounded-[22px] bg-[#EFEAE0] px-5 py-5 shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Care stats</h3>
              <BarChart3
                className="h-5 w-5 text-forest/80"
                strokeWidth={1.75}
                aria-hidden
              />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Dots on the grid: solid = still to do, faded ring = completed that
              day. Pick a date to see the full list.
            </p>
          </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
