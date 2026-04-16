"use client";

import { ImagePlus, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { apiPost } from "@/lib/api";
import { usePlantDetail } from "../PlantDetailContext";
import { readFileAsBase64, specimenCode } from "../plant-detail-shared";

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Present only in memory for the current session */
  imageDataUrl?: string;
};

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function chatStorageKey(plantId: string) {
  return `bloomiq-plant-care-chat-v1:${plantId}`;
}

function safeParseThread(raw: string | null): ChatLine[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: ChatLine[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      if (o.role !== "user" && o.role !== "assistant") continue;
      if (typeof o.content !== "string" || !o.content.trim()) continue;
      const id = typeof o.id === "string" ? o.id : crypto.randomUUID();
      out.push({
        id,
        role: o.role,
        content: o.content.trim(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function persistThread(plantId: string, lines: ChatLine[]) {
  const serializable = lines.map(({ id, role, content }) => ({
    id,
    role,
    content,
  }));
  try {
    localStorage.setItem(chatStorageKey(plantId), JSON.stringify(serializable));
  } catch {
    /* quota or private mode */
  }
}

export function PlantCareLogTab() {
  const { plant, plantId } = usePlantDetail();
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLines(safeParseThread(localStorage.getItem(chatStorageKey(plantId))));
    setHydrated(true);
  }, [plantId]);

  useEffect(() => {
    if (!hydrated) return;
    persistThread(plantId, lines);
  }, [hydrated, plantId, lines]);

  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines, sending]);

  const clearThread = useCallback(() => {
    setLines([]);
    try {
      localStorage.removeItem(chatStorageKey(plantId));
    } catch {
      /* ignore */
    }
    setSendError(null);
  }, [plantId]);

  const onPickFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setSendError(
        `Images must be ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB or smaller.`
      );
      return;
    }
    setSendError(null);
    setPendingFile((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    };
  }, [pendingFile?.previewUrl]);

  const send = useCallback(async () => {
    if (!plant || sending) return;
    const text = draft.trim();
    if (!text && !pendingFile) {
      setSendError("Add a message, a photo, or both.");
      return;
    }

    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;
    let imageDataUrl: string | undefined;
    if (pendingFile) {
      try {
        imageBase64 = await readFileAsBase64(pendingFile.file);
        imageMimeType = pendingFile.file.type || "image/jpeg";
        imageDataUrl = pendingFile.previewUrl;
      } catch {
        setSendError("Could not read the image. Try another file.");
        return;
      }
    }

    const history = lines.map((l) => ({
      role: l.role,
      content: l.content,
    }));

    const userLine: ChatLine = {
      id: crypto.randomUUID(),
      role: "user",
      content:
        text ||
        "Please look at the attached photo and advise on care or identification.",
      imageDataUrl,
    };

    setLines((prev) => [...prev, userLine]);
    setDraft("");
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
    setSending(true);
    setSendError(null);

    const res = await apiPost<{ reply: string }>(
      `/api/plants/${plantId}/care-chat`,
      {
        history,
        message: text,
        ...(imageBase64
          ? { imageBase64, imageMimeType: imageMimeType ?? "image/jpeg" }
          : {}),
      }
    );

    if (!res.success || !res.data?.reply) {
      setLines((prev) => prev.filter((l) => l.id !== userLine.id));
      setSendError(res.error || res.message || "Could not get a reply.");
      setSending(false);
      return;
    }

    setLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.data!.reply,
      },
    ]);
    setSending(false);
  }, [draft, lines, pendingFile, plant, plantId, sending]);

  if (!plant) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col pb-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-forest">Plant care chat</h1>
          <p className="mt-1 text-sm text-muted">
            Ask about {plant.name} ({specimenCode(plant)}). Upload a photo for
            ID, health checks, or placement tips. Timestamps and task log live
            in{" "}
            <Link
              href={`/plants/${plantId}/history`}
              className="font-medium text-forest underline-offset-2 hover:underline"
            >
              History
            </Link>
            .
          </p>
        </div>
        {lines.length > 0 ? (
          <button
            type="button"
            onClick={() => clearThread()}
            className="text-xs font-semibold uppercase tracking-[0.12em] text-muted underline-offset-2 hover:text-forest hover:underline"
          >
            Clear chat
          </button>
        ) : null}
      </div>

      <div className="mt-6 flex min-h-[min(60vh,520px)] flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[0_8px_30px_-8px_rgba(0,0,0,0.1)] ring-1 ring-stone-200/50">
        <div
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {lines.length === 0 && !sending ? (
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed border-stone-200 bg-archive-cream/40 px-5 py-6 text-center text-sm text-muted">
              <Sparkles
                className="mx-auto mb-3 h-8 w-8 text-forest/70"
                aria-hidden
              />
              <p className="font-medium text-ink">Start a conversation</p>
              <p className="mt-2 leading-relaxed">
                Try “The lower leaves are yellow—what should I check?” or
                attach a picture and ask “Does this spot look like sunburn?”
              </p>
            </div>
          ) : null}

          {lines.map((line) => (
            <div
              key={line.id}
              className={`flex gap-3 ${line.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  line.role === "user"
                    ? "bg-forest text-white"
                    : "border border-stone-200 bg-archive-sage/40 text-forest"
                }`}
                aria-hidden
              >
                {line.role === "user" ? "You" : <Sparkles className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[min(100%,28rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  line.role === "user"
                    ? "bg-forest text-white"
                    : "bg-archive-cream text-ink ring-1 ring-stone-100"
                }`}
              >
                {line.imageDataUrl ? (
                  <img
                    src={line.imageDataUrl}
                    alt=""
                    className="mb-2 max-h-48 w-full rounded-xl object-cover"
                  />
                ) : null}
                <p className="whitespace-pre-wrap">{line.content}</p>
              </div>
            </div>
          ))}

          {sending ? (
            <div className="flex gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-archive-sage/40 text-forest"
                aria-hidden
              >
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="rounded-2xl bg-archive-cream px-4 py-3 text-sm text-muted ring-1 ring-stone-100">
                BloomIQ is thinking…
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        {sendError ? (
          <p className="border-t border-stone-100 px-4 py-2 text-center text-xs text-alert sm:px-6">
            {sendError}
          </p>
        ) : null}

        <div className="border-t border-stone-100 bg-archive-cream/50 p-3 sm:p-4">
          {pendingFile ? (
            <div className="relative mb-3 inline-block">
              <img
                src={pendingFile.previewUrl}
                alt="Attachment preview"
                className="h-24 rounded-xl border border-stone-200 object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pendingFile.previewUrl);
                  setPendingFile(null);
                }}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-white shadow-md"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask anything about this plant…"
              rows={2}
              className="min-h-[3rem] flex-1 resize-y rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-ink shadow-inner outline-none ring-forest/20 placeholder:text-muted focus:border-forest/30 focus:ring-2"
              disabled={sending}
            />
            <div className="flex shrink-0 gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onPickFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-stone-200/80 bg-white text-forest transition hover:border-forest/40 hover:bg-archive-sage/30 disabled:opacity-50"
                aria-label="Attach plant photo"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-forest px-5 text-sm font-semibold text-white transition hover:bg-forest/90 disabled:opacity-60 sm:flex-initial sm:px-6"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <SendHorizontal className="h-5 w-5" aria-hidden />
                )}
                Send
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">
            AI can be wrong; use judgment for safety and always verify toxic
            plant risks with a trusted source.
          </p>
        </div>
      </div>
    </div>
  );
}
