"use client";

import {
  Camera,
  Droplets,
  Heart,
  Leaf,
  Plus,
  Sun,
  Thermometer,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { absoluteApiUrl } from "@/lib/backend-origin";
import { usePlantDetail } from "../PlantDetailContext";
import {
  careTips,
  healthHeadline,
  healthSeries,
  lightLevel,
  MONTHS,
  specimenCode,
  wateringSummary,
} from "../plant-detail-shared";

export function PlantOverviewTab() {
  const cameraRef = useRef<HTMLInputElement>(null);
  const {
    plant,
    waterPlan,
    busyWater,
    busyPhoto,
    markWatered,
    setNoteOpen,
    onPhotoPick,
    plantId,
  } = usePlantDetail();

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

  if (!plant) return null;

  const archiveLabel =
    plant.status === "archived" ? "Archived specimen" : "Living specimen";

  return (
    <>
      <section className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-10 lg:gap-x-12">
        <div className="min-w-0">
          <Link
            href={`/plants/${plantId}/gallery`}
            className="group relative block aspect-video w-full overflow-hidden rounded-[1.5rem] bg-stone-200 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-stone-200/60"
          >
            {imgSrc ? (
              plant.imageUrl?.startsWith("/api/plants/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgSrc}
                  alt=""
                  className="h-full w-full object-cover transition group-hover:opacity-95"
                />
              ) : (
                <Image
                  src={imgSrc}
                  alt=""
                  fill
                  className="object-cover transition group-hover:opacity-95"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center text-forest/25">
                <Leaf className="h-24 w-24" strokeWidth={1} />
              </div>
            )}
            <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 justify-center">
              <span className="rounded-full bg-forest px-4 py-2 text-xs font-semibold tracking-wide text-white shadow-md">
                Specimen ID: {specimenCode(plant)}
              </span>
            </div>
            <span className="sr-only">Open gallery</span>
          </Link>
        </div>

        <div className="mt-6 flex flex-col justify-start lg:mt-0 lg:pl-1">
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

      <section className="mt-10">
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

      <section className="mt-12 space-y-8">
        <div>
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
        </div>

        <section>
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
      </section>
    </>
  );
}
