"use client";

import Link from "next/link";
import { usePlantDetail } from "../PlantDetailContext";
import { activityBlurb, activityHeadline } from "../plant-detail-shared";

export function PlantHistoryTab() {
  const {
    activities,
    plant,
    plantId,
    activityPageLoaded,
    activityTotalPages,
    loadMoreHistory,
  } = usePlantDetail();

  if (!plant) return null;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest">History</h1>
      <p className="mt-1 text-sm text-muted">
        Full archive for {plant.name}—newest first.
      </p>

      <div className="mt-8 rounded-[1.5rem] bg-white p-6 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.1)] ring-1 ring-stone-200/50 sm:p-8">
        <p className="text-sm text-muted">
          Watering, notes, care tasks, and milestones in chronological order
          (newest at the top).
        </p>
        <ol className="relative mt-8 space-y-0 border-t border-stone-100 pt-8">
          <span
            className="absolute left-[11px] top-10 bottom-8 w-px bg-stone-200"
            aria-hidden
          />
          {activities.length === 0 ? (
            <li className="relative pb-2 pl-10 text-sm text-muted">
              No entries yet. From{" "}
              <Link
                href={`/plants/${plantId}/overview`}
                className="font-medium text-forest underline-offset-2 hover:underline"
              >
                Overview
              </Link>
              , mark watering or add a note, or complete tasks from the
              dashboard.
            </li>
          ) : (
            activities.map((a) => (
              <li key={a._id} className="relative pb-10 pl-10 last:pb-2">
                <span className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-forest bg-archive-cream" />
                <time
                  dateTime={a.date}
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(a.date))}
                </time>
                <p className="mt-1 text-base font-semibold text-ink">
                  {activityHeadline(a)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {activityBlurb(a)}
                </p>
              </li>
            ))
          )}
        </ol>
        {activities.length > 0 ? (
          <button
            type="button"
            disabled={activityPageLoaded >= activityTotalPages}
            onClick={() => void loadMoreHistory()}
            className="mt-2 w-full rounded-[1rem] border-2 border-stone-200/80 py-3 text-xs font-bold uppercase tracking-[0.15em] text-forest transition hover:border-forest/40 hover:bg-archive-sage/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {activityPageLoaded >= activityTotalPages
              ? "End of archive"
              : "Load older entries"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
