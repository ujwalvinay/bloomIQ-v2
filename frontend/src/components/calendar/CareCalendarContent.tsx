"use client";

import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Leaf,
  Sprout,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type ViewMode = "month" | "week";

type TaskKind = "water" | "nutrient" | "soil";

type CalendarTask = {
  id: string;
  kind: TaskKind;
  title: string;
  plantLine: string;
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

function buildDemoTasksForMonth(y: number, m: number): Record<string, CalendarTask[]> {
  const k = (d: number) => toKey(y, m, d);
  return {
    [k(2)]: [
      {
        id: `${y}-${m}-2-w`,
        kind: "water",
        title: "Morning mist",
        plantLine: "Snake plant • Light spray",
      },
    ],
    [k(4)]: [
      {
        id: `${y}-${m}-4-n`,
        kind: "nutrient",
        title: "Leaf feed",
        plantLine: "Pothos • Diluted fertilizer",
      },
    ],
    [k(7)]: [
      {
        id: `${y}-${m}-7-w`,
        kind: "water",
        title: "Hydration ritual",
        plantLine: "Fiddle leaf fig • 500ml filtered",
      },
      {
        id: `${y}-${m}-7-n`,
        kind: "nutrient",
        title: "Nutrient infusion",
        plantLine: "Swiss cheese plant • 10-10-10 mix",
      },
      {
        id: `${y}-${m}-7-s`,
        kind: "soil",
        title: "Relocation & soil check",
        plantLine: "Jade plant • Check root health",
      },
    ],
    [k(10)]: [
      {
        id: `${y}-${m}-10-w`,
        kind: "water",
        title: "Deep water",
        plantLine: "Rubber plant • Until drain",
      },
    ],
    [k(14)]: [
      {
        id: `${y}-${m}-14-n`,
        kind: "nutrient",
        title: "Seasonal feed",
        plantLine: "Monstera • Slow-release",
      },
    ],
    [k(16)]: [
      {
        id: `${y}-${m}-16-w`,
        kind: "water",
        title: "Top-up",
        plantLine: "Peace lily • Room-temp water",
      },
    ],
  };
}

function CellTaskIcon({ kind, className }: { kind: TaskKind; className?: string }) {
  const cn = className ?? "h-3.5 w-3.5";
  if (kind === "water")
    return <Droplets className={cn} strokeWidth={2} aria-hidden />;
  if (kind === "nutrient")
    return <Leaf className={cn} strokeWidth={2} aria-hidden />;
  return <Sprout className={cn} strokeWidth={2} aria-hidden />;
}

function TaskIconBadge({ kind }: { kind: TaskKind }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage/80 text-forest">
      <CellTaskIcon kind={kind} className="h-4 w-4" />
    </span>
  );
}

export function CareCalendarContent() {
  const today = useMemo(() => {
    const n = new Date();
    return toKey(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [visibleY, setVisibleY] = useState(() => new Date().getFullYear());
  const [visibleM, setVisibleM] = useState(() => new Date().getMonth());
  const [selectedKey, setSelectedKey] = useState(today);
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());

  const tasksByDate = useMemo(
    () => buildDemoTasksForMonth(visibleY, visibleM),
    [visibleY, visibleM],
  );

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

  const pendingForSelected = useMemo(() => {
    const list = tasksByDate[selectedKey] ?? [];
    return list.filter((t) => !doneIds.has(t.id));
  }, [tasksByDate, selectedKey, doneIds]);

  const totalForSelected = tasksByDate[selectedKey]?.length ?? 0;

  const markDone = (id: string) => {
    setDoneIds((prev) => new Set(prev).add(id));
  };

  const efficiency = 92;

  return (
    <div className="min-h-screen bg-care-canvas px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
          Monthly schedule
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
          Care calendar
        </h1>
      </header>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-10">
        <section className="min-w-0 flex-1 rounded-[22px] bg-white p-5 shadow-soft sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

          <div className="mt-6 grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>

          {viewMode === "month" ? (
            <div className="mt-1 grid grid-cols-7 gap-2">
              {monthCells.map((day, idx) => {
                if (day === null) {
                  return <div key={`e-${idx}`} className="min-h-[88px]" />;
                }
                const key = toKey(visibleY, visibleM, day);
                const tasks = tasksByDate[key] ?? [];
                const selected = key === selectedKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    className={`flex min-h-[88px] flex-col rounded-2xl border p-2 text-left transition ${
                      selected
                        ? "border-forest bg-sage/70 shadow-sm"
                        : "border-transparent bg-care-canvas/40 hover:bg-care-canvas"
                    }`}
                  >
                    <span
                      className={`text-sm font-semibold ${
                        selected ? "text-forest" : "text-ink"
                      }`}
                    >
                      {day}
                    </span>
                    {tasks.length > 0 && (
                      <div className="mt-auto flex flex-wrap justify-end gap-1 pt-1 text-forest">
                        {tasks.slice(0, 4).map((t) => (
                          <span
                            key={t.id}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-forest shadow-sm"
                          >
                            <CellTaskIcon kind={t.kind} className="h-3 w-3" />
                          </span>
                        ))}
                        {tasks.length > 4 && (
                          <span className="text-[10px] font-bold text-muted">
                            +{tasks.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-1 grid grid-cols-7 gap-2">
              {weekDays.map((dt) => {
                const y = dt.getFullYear();
                const m = dt.getMonth();
                const d = dt.getDate();
                const key = toKey(y, m, d);
                const tasks = buildDemoTasksForMonth(y, m)[key] ?? [];
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
                    className={`flex min-h-[100px] flex-col rounded-2xl border p-2 text-left transition ${
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
                    {tasks.length > 0 && (
                      <div className="mt-auto flex flex-wrap justify-end gap-1 pt-1 text-forest">
                        {tasks.slice(0, 4).map((t) => (
                          <span
                            key={t.id}
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-sm"
                          >
                            <CellTaskIcon kind={t.kind} className="h-3 w-3" />
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="w-full shrink-0 space-y-6 xl:w-[380px]">
          <div className="rounded-[22px] bg-forest px-6 py-6 text-white shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Selected day
            </p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <p className="text-2xl font-bold leading-tight">
                {formatSelectedHeading(selectedKey)}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-medium text-white/90">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </span>
              <span>
                {totalForSelected}{" "}
                {totalForSelected === 1 ? "task" : "tasks"} scheduled
              </span>
            </div>
          </div>

          <div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Pending tasks
            </p>
            <ul className="space-y-3">
              {pendingForSelected.length === 0 ? (
                <li className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-8 text-center text-sm text-muted">
                  Nothing due on this day. Pick another date or add care
                  plans from your plants.
                </li>
              ) : (
                pendingForSelected.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-[18px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04]"
                  >
                    <div className="flex gap-3">
                      <TaskIconBadge kind={task.kind} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold capitalize text-ink">
                          {task.title}
                        </p>
                        <p className="mt-1 text-sm text-muted">{task.plantLine}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => markDone(task.id)}
                      className="mt-4 text-left text-xs font-semibold uppercase tracking-wide text-forest transition hover:text-olive-dark"
                    >
                      Mark as done →
                    </button>
                  </li>
                ))
              )}
            </ul>
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
            <div className="mt-5 flex items-center justify-between text-sm">
              <span className="text-muted">Efficiency this week</span>
              <span className="text-lg font-bold text-forest">{efficiency}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full rounded-full bg-forest"
                style={{ width: `${efficiency}%` }}
              />
            </div>
            <p className="mt-4 text-xs italic leading-relaxed text-muted">
              You&apos;ve missed only 1 watering session in the last 14 days.
              Keep it up!
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
