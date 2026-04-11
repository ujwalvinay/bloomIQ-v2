"use client";

import { Bell, Camera, Search, Sprout } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type SafeUser = {
  _id: string;
  name: string;
  email: string;
};

type CreatedPlant = {
  _id: string;
};

const LOCATIONS = [
  "Living Room",
  "Bedroom",
  "Kitchen",
  "Garden",
  "Courtyard",
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function monthsToFrequencyDays(months: number): number {
  return Math.max(1, Math.round(months * 30));
}

export function AddPlantContent() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<SafeUser | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState<(typeof LOCATIONS)[number]>("Bedroom");
  const [waterDays, setWaterDays] = useState(7);
  const [fertilizeMonths, setFertilizeMonths] = useState(1);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await apiGet<SafeUser>("/api/auth/me");
      if (cancelled) return;
      if (!res.success || !res.data) {
        router.push("/login");
        return;
      }
      setUser(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a plant name.");
      return;
    }
    setSubmitting(true);
    try {
      const plantRes = await apiPost<CreatedPlant>("/api/plants", {
        name: trimmedName,
        species: species.trim() || undefined,
        location,
        imageUrl: imageUrl.trim() || undefined,
      });
      if (!plantRes.success || !plantRes.data) {
        setError(plantRes.error || plantRes.message);
        return;
      }
      const plantId = plantRes.data._id;
      const startDate = new Date().toISOString();

      const waterRes = await apiPost<unknown>("/api/care-plans", {
        plantId,
        type: "watering",
        frequencyDays: Math.max(1, waterDays),
        startDate,
      });
      if (!waterRes.success) {
        setError(
          `Plant was saved, but watering schedule failed: ${waterRes.error || waterRes.message}. You can add care plans from My plants when available.`
        );
        return;
      }

      const fertRes = await apiPost<unknown>("/api/care-plans", {
        plantId,
        type: "fertilizing",
        frequencyDays: monthsToFrequencyDays(Math.max(1, fertilizeMonths)),
        startDate,
      });
      if (!fertRes.success) {
        setError(
          `Watering schedule was saved, but fertilizing failed: ${fertRes.error || fertRes.message}.`
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#FAF9F6] pb-16">
      <header className="flex flex-col gap-4 border-b border-stone-200/60 bg-[#FAF9F6]/95 px-6 py-5 backdrop-blur-sm lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-6">
        <div className="relative max-w-xl flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search your conservatory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border-0 bg-[#E8E6E0] py-3.5 pl-11 pr-5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/25"
            aria-label="Search conservatory"
          />
        </div>
        <div className="flex items-center gap-4 lg:gap-5">
          <button
            type="button"
            className="relative rounded-full p-2 text-olive-cta transition hover:bg-black/[0.04]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#FAF9F6]" />
          </button>
          <div className="flex items-center gap-3 text-right">
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold text-ink">
                {user?.name ?? "…"}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                Head curator
              </p>
            </div>
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D9E8D1] text-sm font-semibold text-olive-cta"
              aria-hidden
            >
              {initials(user?.name ?? "?")}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] ring-1 ring-stone-200/50 lg:flex-row lg:min-h-[560px]">
          <div className="flex flex-col bg-[#E8E4D9] px-8 py-10 lg:w-[min(44%,420px)] lg:shrink-0 lg:px-10 lg:py-12">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 flex-col items-center justify-center rounded-[1.35rem] border-2 border-dashed border-stone-400/50 bg-[#E8E4D9]/80 px-6 py-12 text-center transition hover:border-stone-500/60 hover:bg-[#E5E1D6]"
            >
              {previewUrl ? (
                <div className="relative mb-4 h-40 w-full max-w-[220px] overflow-hidden rounded-xl bg-stone-300/40">
                  <Image
                    src={previewUrl}
                    alt=""
                    fill
                    unoptimized={previewUrl.startsWith("blob:")}
                    className="object-cover"
                    sizes="220px"
                  />
                </div>
              ) : (
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#D9E8D1]">
                  <Camera className="h-9 w-9 text-olive-cta" strokeWidth={1.5} />
                </div>
              )}
              <p className="text-base font-semibold text-ink">Upload Plant Portrait</p>
              <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-muted">
                Let&apos;s give your new addition a visual record in the archive.
              </p>
            </button>

            <label className="mt-6 block">
              <span className="sr-only">Image URL</span>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Optional: paste image URL to save portrait"
                className="w-full rounded-2xl border-0 bg-white/60 px-4 py-3 text-xs text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/20"
              />
            </label>

            <div className="mt-auto pt-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-olive-cta">
                Botanical tip
              </p>
              <p className="mt-2 text-sm italic leading-relaxed text-muted">
                Natural indirect light provides the best photographic clarity for
                identification.
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-col bg-white px-8 py-10 lg:px-12 lg:py-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-olive">
              New entry
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink lg:text-[2rem]">
              Expand Your Conservatory
            </h1>

            <form onSubmit={onSubmit} className="mt-8 flex flex-1 flex-col">
              {error ? (
                <p
                  className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="plant-name"
                    className="text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    Plant name
                  </label>
                  <input
                    id="plant-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Luna the Monste…"
                    className="mt-2 w-full rounded-2xl border-0 bg-[#F3F2EF] px-4 py-3.5 text-sm text-ink placeholder:text-muted/60 focus:bg-white focus:ring-2 focus:ring-olive/20"
                    required
                    maxLength={200}
                  />
                </div>
                <div>
                  <label
                    htmlFor="plant-species"
                    className="text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    Species / type
                  </label>
                  <input
                    id="plant-species"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value)}
                    placeholder="e.g. Monstera Deliciosa"
                    className="mt-2 w-full rounded-2xl border-0 bg-[#F3F2EF] px-4 py-3.5 text-sm text-ink placeholder:text-muted/60 focus:bg-white focus:ring-2 focus:ring-olive/20"
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Location
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LOCATIONS.map((loc) => {
                    const active = location === loc;
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocation(loc)}
                        className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
                          active
                            ? "bg-[#D9E8D1] text-olive-cta"
                            : "bg-[#F3F2EF] text-muted hover:bg-stone-200/80"
                        }`}
                      >
                        {loc}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="water-freq"
                    className="text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    Watering frequency
                  </label>
                  <div className="mt-2 flex items-stretch overflow-hidden rounded-2xl bg-[#F3F2EF] ring-1 ring-stone-200/40 focus-within:ring-2 focus-within:ring-olive/25">
                    <input
                      id="water-freq"
                      type="number"
                      min={1}
                      max={365}
                      value={waterDays}
                      onChange={(e) =>
                        setWaterDays(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full min-w-0 border-0 bg-transparent px-4 py-3.5 text-sm font-medium text-ink focus:ring-0"
                    />
                    <span className="flex items-center border-l border-stone-200/60 bg-[#EDECE8] px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                      Days
                    </span>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="fert-freq"
                    className="text-[10px] font-semibold uppercase tracking-wider text-muted"
                  >
                    Fertilizing frequency
                  </label>
                  <div className="mt-2 flex items-stretch overflow-hidden rounded-2xl bg-[#F3F2EF] ring-1 ring-stone-200/40 focus-within:ring-2 focus-within:ring-olive/25">
                    <input
                      id="fert-freq"
                      type="number"
                      min={1}
                      max={24}
                      value={fertilizeMonths}
                      onChange={(e) =>
                        setFertilizeMonths(Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-full min-w-0 border-0 bg-transparent px-4 py-3.5 text-sm font-medium text-ink focus:ring-0"
                    />
                    <span className="flex items-center border-l border-stone-200/60 bg-[#EDECE8] px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                      Months
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-10">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-olive-cta py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-olive-cta/92 disabled:opacity-60"
                >
                  <Sprout className="h-5 w-5" strokeWidth={2} aria-hidden />
                  {submitting ? "Adding…" : "Add to Conservatory"}
                </button>
                <p className="mt-4 text-center text-[11px] tracking-wide text-muted">
                  Step 1 of 1 • Vital statistics
                </p>
                <p className="mt-3 text-center text-xs text-muted">
                  <Link href="/plants" className="font-medium text-olive hover:underline">
                    Cancel
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
