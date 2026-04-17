"use client";

import { Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type AiBriefPayload = {
  content: string | null;
  contentKind: "ai" | "user_edited" | null;
  sourceFingerprint: string | null;
  currentFingerprint: string;
  isStale: boolean;
  updatedAt: string | null;
  statsPreview?: {
    totalPlants: number;
    tasksDueToday: number;
    overdueTasks: number;
  };
};

export function InsightsAiBriefSection() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<AiBriefPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiGet<AiBriefPayload>("/api/insights/ai-brief");
      if (!res.success || !res.data) {
        setError(res.error || res.message || "Could not load AI brief.");
        setPayload(null);
        return;
      }
      setPayload(res.data);
      setDraft(res.data.content ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    const saved = payload?.content ?? "";
    return draft.trim() !== saved.trim();
  }, [draft, payload?.content]);

  const kindLabel =
    payload?.contentKind === "user_edited"
      ? "Your version"
      : payload?.contentKind === "ai"
        ? "BloomIQ AI"
        : "Not generated yet";

  const onRegenerate = async () => {
    if (dirty && payload?.contentKind === "user_edited") {
      const ok = window.confirm(
        "Regenerate will replace the text in the editor with a new AI brief. Unsaved edits will be lost. Continue?"
      );
      if (!ok) return;
    } else if (dirty) {
      const ok = window.confirm(
        "You have unsaved edits. Regenerate will replace them. Continue?"
      );
      if (!ok) return;
    }

    setRegenBusy(true);
    setError(null);
    try {
      const res = await apiPost<AiBriefPayload>("/api/insights/ai-brief", {
        regenerate: true,
      });
      if (!res.success || !res.data) {
        setError(res.error || res.message || "Could not regenerate.");
        return;
      }
      setPayload(res.data);
      setDraft(res.data.content ?? "");
    } finally {
      setRegenBusy(false);
    }
  };

  const onSave = async () => {
    const text = draft.trim();
    if (!text) {
      setError("Write something before saving, or regenerate from your data.");
      return;
    }
    setSaveBusy(true);
    setError(null);
    try {
      const res = await apiPatch<AiBriefPayload>("/api/insights/ai-brief", {
        content: text,
      });
      if (!res.success || !res.data) {
        setError(res.error || res.message || "Could not save.");
        return;
      }
      setPayload(res.data);
      setDraft(res.data.content ?? "");
    } finally {
      setSaveBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] lg:p-7">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading AI brief…
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-[22px] bg-gradient-to-br from-white via-white to-sage/25 p-6 shadow-soft ring-1 ring-black/[0.06] lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-lg font-bold text-ink">AI conservatory brief</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            A narrative snapshot from your live stats and plant list. Regenerate
            anytime, or edit the text and save your own version.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="rounded-full bg-input-deep px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted ring-1 ring-black/[0.06]">
            {kindLabel}
          </span>
          {payload?.isStale ? (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-900 ring-1 ring-amber-200/80">
              Stats changed since last AI run
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-alert" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onRegenerate()}
          disabled={regenBusy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-forest px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-olive-dark disabled:opacity-60"
        >
          {regenBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
          Regenerate from data
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saveBusy || !dirty}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-care-canvas disabled:opacity-50"
        >
          {saveBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Save my edits
        </button>
      </div>

      <label className="mt-5 block">
        <span className="sr-only">Brief text</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={12}
          spellCheck
          className="w-full resize-y rounded-2xl border-0 bg-white/90 px-4 py-3 text-sm leading-relaxed text-ink shadow-inner ring-1 ring-black/[0.08] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-forest/35"
          placeholder="Generate a brief to fill this space, or write your own conservatory notes here."
        />
      </label>

      {payload?.updatedAt ? (
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
          Last updated{" "}
          {new Date(payload.updatedAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      ) : null}
    </section>
  );
}
