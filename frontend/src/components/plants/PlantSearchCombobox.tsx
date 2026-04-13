"use client";

import { Leaf, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { absoluteApiUrl } from "@/lib/backend-origin";
import { apiGet, type ApiEnvelope } from "@/lib/api";

type PlantRow = {
  _id: string;
  name: string;
  species?: string;
  location?: string;
  imageUrl?: string;
  status: string;
};

type PlantsListPayload = {
  items: PlantRow[];
  page: number;
  total: number;
  totalPages: number;
};

type PlantSearchComboboxProps = {
  value: string;
  onChange: (next: string) => void;
  /** Called after debounce; use to sync URL / refetch lists (trimmed query). */
  onDebouncedChange?: (trimmedQuery: string) => void;
  debounceMs?: number;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Compact header variant (smaller text, tighter padding). */
  compact?: boolean;
  showClear?: boolean;
  onClear?: () => void;
  /** Called right before navigating to a plant (e.g. clear local query). */
  onNavigate?: () => void;
};

export function PlantSearchCombobox({
  value,
  onChange,
  onDebouncedChange,
  debounceMs = 350,
  placeholder = "Search plants…",
  className = "",
  inputClassName = "",
  compact = false,
  showClear = false,
  onClear,
  onNavigate,
}: PlantSearchComboboxProps) {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PlantRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = value.trim();
      onDebouncedChange?.(q);
    }, debounceMs);
    return () => clearTimeout(t);
  }, [value, debounceMs, onDebouncedChange]);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    const handle = setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        const res: ApiEnvelope<PlantsListPayload> = await apiGet(
          `/api/plants?limit=12&page=1&sort=name&search=${encodeURIComponent(q)}`
        );
        setLoading(false);
        if (!res.success || !res.data) {
          setError(res.error || res.message || "Search failed.");
          setResults([]);
          return;
        }
        setResults(res.data.items);
      })();
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [value, debounceMs]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [menuOpen]);

  const showPanel = menuOpen && value.trim().length > 0;
  const trimmed = value.trim();

  const goToPlant = useCallback(
    (id: string) => {
      setMenuOpen(false);
      onNavigate?.();
      router.push(`/plants/${id}/overview`);
    },
    [router, onNavigate]
  );

  function handleClear() {
    onChange("");
    onDebouncedChange?.("");
    setResults([]);
    setError(null);
    onClear?.();
  }

  const padY = compact ? "py-2.5" : "py-3.5";
  const plInput = compact ? "pl-9" : "pl-11";
  const iconLeft = compact ? "left-3" : "left-4";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      ref={rootRef}
      className={`relative ${className}`}
      role="combobox"
      aria-expanded={showPanel}
      aria-haspopup="listbox"
      aria-controls={listId}
    >
      <Search
        className={`pointer-events-none absolute ${iconLeft} top-1/2 ${iconSize} -translate-y-1/2 text-muted`}
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setMenuOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full rounded-full border-0 ${padY} ${plInput} ${showClear && trimmed ? "pr-20" : compact ? "pr-3" : "pr-11"} text-sm text-ink placeholder:text-muted/70 focus:ring-2 focus:ring-forest/25 ${inputClassName}`}
        aria-label="Search plants"
        aria-autocomplete="list"
      />
      {showClear && trimmed ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted hover:bg-black/[0.06] hover:text-ink"
        >
          Clear
        </button>
      ) : null}

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Matching plants"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(22rem,50vh)] overflow-y-auto rounded-2xl border border-stone-200/90 bg-white py-2 shadow-lg ring-1 ring-black/[0.04]"
        >
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Searching…
            </p>
          ) : error ? (
            <p className="px-4 py-4 text-sm text-alert" role="alert">
              {error}
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No plants match “{trimmed}”.
            </p>
          ) : (
            <ul className="space-y-0.5 px-1">
              {results.map((plant) => {
                const imgSrc =
                  plant.imageUrl?.startsWith("/api/plants/") && plant.imageUrl
                    ? absoluteApiUrl(plant.imageUrl)
                    : plant.imageUrl;
                return (
                  <li key={plant._id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-sage/50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => goToPlant(plant._id)}
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-stone-200">
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
                              sizes="40px"
                            />
                          )
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-forest/30">
                            <Leaf className="h-4 w-4" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">
                          {plant.name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {[plant.species, plant.location]
                            .filter(Boolean)
                            .join(" · ") || "Open plant page"}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && !error && results.length > 0 ? (
            <p className="border-t border-stone-100 px-4 py-2 text-[11px] text-muted">
              Click a plant to open its archive.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
