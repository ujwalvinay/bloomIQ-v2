"use client";

import Link from "next/link";
import { usePlantDetail } from "../PlantDetailContext";
import { activityBlurb, activityHeadline } from "../plant-detail-shared";

export function PlantCareLogTab() {
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
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold text-forest">Care log</h1>
      <p className="mt-1 text-sm text-muted">
        Timeline for {plant.name}. Use History for the same archive with
        timestamps and pagination focused on deep review.
      </p>

      <div className="mt-8 rounded-[1.5rem] bg-white p-6 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.1)] ring-1 ring-stone-200/50 sm:p-8">
        <h2 className="text-lg font-semibold text-ink">Growth archive</h2>
        <ol className="relative mt-6 space-y-0 pl-2">
          <span
            className="absolute left-[7px] top-2 bottom-8 w-px bg-stone-200"
            aria-hidden
          />
          {activities.length === 0 ? (
            <li className="relative pb-8 pl-8 text-sm text-muted">
              No log entries yet. Water or add a note from the overview, or
              complete a task from the dashboard.
            </li>
          ) : (
            activities.map((a) => (
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

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={`/plants/${plantId}/history`}
            className="flex flex-1 items-center justify-center rounded-[1rem] border-2 border-stone-200/80 py-3 text-center text-xs font-bold uppercase tracking-[0.15em] text-forest transition hover:border-forest/40 hover:bg-archive-sage/30"
          >
            Open history view
          </Link>
          {activities.length > 0 && activityPageLoaded < activityTotalPages ? (
            <button
              type="button"
              onClick={() => void loadMoreHistory()}
              className="flex flex-1 items-center justify-center rounded-[1rem] border-2 border-stone-200/80 py-3 text-xs font-bold uppercase tracking-[0.15em] text-forest transition hover:border-forest/40 hover:bg-archive-sage/30"
            >
              Load older entries
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
