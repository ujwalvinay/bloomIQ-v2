"use client";

import {
  Bell,
  Camera,
  ChevronRight,
  Eye,
  Lock,
  KeyRound,
  Minus,
  Shield,
  Sprout,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type ApiEnvelope,
} from "@/lib/api";
import { absoluteApiUrl } from "@/lib/backend-origin";

const LS_KEY = "bloomiq-account-settings";

type SafeUser = {
  _id: string;
  name: string;
  email: string;
  timezone: string;
  notificationEnabled: boolean;
  avatarUrl: string | null;
  updatedAt?: string;
};

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

type LocalPrefs = {
  fertilizationTips: boolean;
  communityNews: boolean;
  conservatory: "visible" | "private";
  searchVisible: boolean;
};

const defaultLocalPrefs: LocalPrefs = {
  fertilizationTips: true,
  communityNews: false,
  conservatory: "visible",
  searchVisible: false,
};

function loadLocalPrefs(): LocalPrefs {
  if (typeof window === "undefined") return defaultLocalPrefs;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultLocalPrefs;
    const p = JSON.parse(raw) as Partial<LocalPrefs>;
    return {
      fertilizationTips:
        typeof p.fertilizationTips === "boolean"
          ? p.fertilizationTips
          : defaultLocalPrefs.fertilizationTips,
      communityNews:
        typeof p.communityNews === "boolean"
          ? p.communityNews
          : defaultLocalPrefs.communityNews,
      conservatory:
        p.conservatory === "private" ? "private" : "visible",
      searchVisible:
        typeof p.searchVisible === "boolean"
          ? p.searchVisible
          : defaultLocalPrefs.searchVisible,
    };
  } catch {
    return defaultLocalPrefs;
  }
}

function saveLocalPrefs(p: LocalPrefs) {
  localStorage.setItem(LS_KEY, JSON.stringify(p));
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function Toggle({
  checked,
  onChange,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        checked ? "bg-forest" : "bg-input-deep"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`absolute top-0.5 flex h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsPageContent() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [wateringAlerts, setWateringAlerts] = useState(true);
  const [localPrefs, setLocalPrefs] = useState<LocalPrefs>(defaultLocalPrefs);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBust, setAvatarBust] = useState(0);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res: ApiEnvelope<SafeUser> = await apiGet<SafeUser>("/api/auth/me");
      if (!res.success || !res.data) {
        setError(res.error || res.message || "Could not load account.");
        return;
      }
      setDisplayName(res.data.name);
      setEmail(res.data.email);
      setWateringAlerts(res.data.notificationEnabled);
      setAvatarUrl(res.data.avatarUrl ?? null);
      setAvatarBust(Date.now());
      setLocalPrefs(loadLocalPrefs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setAvatarError("Please choose an image file.");
      return;
    }
    if (f.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be 3MB or smaller.");
      return;
    }
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const imageBase64 = await readFileAsBase64(f);
      const res = await apiPost<SafeUser>("/api/auth/me/avatar", {
        imageBase64,
        imageMimeType: f.type || "image/jpeg",
      });
      if (!res.success || !res.data) {
        setAvatarError(res.error || res.message || "Upload failed.");
        return;
      }
      setAvatarUrl(res.data.avatarUrl ?? null);
      setAvatarBust(Date.now());
      setSavedMsg("Profile photo saved.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onRemoveAvatar() {
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const res = await apiDelete<SafeUser>("/api/auth/me/avatar");
      if (!res.success || !res.data) {
        setAvatarError(res.error || res.message || "Could not remove photo.");
        return;
      }
      setAvatarUrl(res.data.avatarUrl ?? null);
      setAvatarBust(Date.now());
      setSavedMsg("Profile photo removed.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSavedMsg(null);
    setError(null);
    const nameTrim = displayName.trim();
    if (!nameTrim) {
      setError("Display name is required.");
      return;
    }
    setSaving(true);
    try {
      const patchRes = await apiPatch<SafeUser>("/api/auth/me", {
        name: nameTrim,
        notificationEnabled: wateringAlerts,
      });
      if (!patchRes.success || !patchRes.data) {
        setError(patchRes.error || patchRes.message || "Save failed.");
        return;
      }
      setDisplayName(patchRes.data.name);
      setWateringAlerts(patchRes.data.notificationEnabled);
      setAvatarUrl(patchRes.data.avatarUrl ?? null);
      saveLocalPrefs(localPrefs);
      setSavedMsg("Your settings were saved.");
    } finally {
      setSaving(false);
    }
  }

  function onDeleteAccount() {
    const ok = window.confirm(
      "Delete your BloomIQ account? This cannot be undone from the app.",
    );
    if (ok) {
      window.alert(
        "Account deletion is not enabled yet. Please contact support if you need to remove your data.",
      );
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-care-canvas px-6 py-10 lg:px-10">
        <p className="text-sm text-muted">Loading settings…</p>
      </div>
    );
  }

  if (error && !displayName && !email) {
    return (
      <div className="min-h-screen bg-care-canvas px-6 py-10 lg:px-10">
        <p className="text-sm text-alert" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-care-canvas px-6 py-8 lg:px-10 lg:py-10">
      <header className="mb-8 max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-forest">
          Account settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Tailor your botanical experience. Manage notifications, security, and
          your public gardener profile.
        </p>
      </header>

      <form onSubmit={onSave}>
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="space-y-6">
            <section className="rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] sm:p-7">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="relative shrink-0">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full bg-sage ring-2 ring-white shadow-sm">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- cookie-auth bytes; same pattern as plant images
                      <img
                        src={`${absoluteApiUrl(avatarUrl)}?v=${avatarBust}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-bold text-forest">
                        {initials(displayName || email || "?")}
                      </span>
                    )}
                    {avatarUploading ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-white/60 text-xs font-semibold text-forest backdrop-blur-[2px]">
                        …
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-0.5 -right-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-forest text-white shadow-md transition hover:bg-olive-dark disabled:opacity-50"
                    aria-label="Upload profile photo"
                  >
                    <Camera className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => void onAvatarChange(e)}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-forest">
                    {displayName || "Grower"}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    Master gardener
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={avatarUploading}
                      className="text-sm font-semibold text-forest underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      Change avatar
                    </button>
                    {avatarUrl ? (
                      <button
                        type="button"
                        onClick={() => void onRemoveAvatar()}
                        disabled={avatarUploading}
                        className="text-sm font-semibold text-muted underline-offset-2 hover:text-alert hover:underline disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </div>
                  {avatarError ? (
                    <p className="mt-2 text-xs text-alert" role="alert">
                      {avatarError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="settings-display-name"
                    className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-muted"
                  >
                    Display name
                  </label>
                  <input
                    id="settings-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-full border-0 bg-input px-4 py-3 text-sm font-medium text-ink shadow-inner outline-none ring-1 ring-black/[0.06] transition placeholder:text-muted/70 focus:ring-2 focus:ring-forest/35"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="settings-email"
                    className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-muted"
                  >
                    Email address
                  </label>
                  <input
                    id="settings-email"
                    value={email}
                    readOnly
                    className="w-full cursor-not-allowed rounded-full border-0 bg-input/80 px-4 py-3 text-sm font-medium text-muted shadow-inner ring-1 ring-black/[0.04]"
                    aria-readonly="true"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-bold text-forest">
                <Shield className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                Security &amp; access
              </h2>
              <ul className="mt-5 space-y-3">
                <li>
                  <Link
                    href="/forgot-password"
                    className="flex w-full items-center gap-3 rounded-2xl bg-archive-cream px-4 py-3.5 text-left transition hover:bg-sage/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-forest shadow-sm">
                      <Lock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">
                        Change password
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        We&apos;ll email you a secure reset link
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted"
                      aria-hidden
                    />
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl bg-archive-cream px-4 py-3.5 text-left transition hover:bg-sage/50"
                    onClick={() =>
                      window.alert(
                        "Two-factor authentication is not set up yet.",
                      )
                    }
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-forest shadow-sm">
                      <KeyRound
                        className="h-5 w-5"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-ink">
                        Two-factor authentication
                      </span>
                      <span className="mt-0.5 block text-xs font-medium italic text-forest">
                        Highly recommended
                      </span>
                    </span>
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-muted"
                      aria-hidden
                    />
                  </button>
                </li>
              </ul>
              <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                Connected accounts
              </p>
              <div className="mt-3 flex gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white shadow-sm"
                  title="Placeholder provider"
                >
                  <Minus className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-olive-cta text-white shadow-sm"
                  title="BloomIQ"
                >
                  <Sprout className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-bold text-forest">
                <Bell className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                Reminders
              </h2>
              <ul className="mt-6 space-y-6">
                <li className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">Watering alerts</p>
                    <p className="mt-1 text-sm text-muted">
                      Get notified when a plant is thirsty.
                    </p>
                  </div>
                  <Toggle
                    id="toggle-water"
                    checked={wateringAlerts}
                    onChange={setWateringAlerts}
                  />
                </li>
                <li className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">Fertilization tips</p>
                    <p className="mt-1 text-sm text-muted">
                      Monthly seasonal growth advice.
                    </p>
                  </div>
                  <Toggle
                    id="toggle-fert"
                    checked={localPrefs.fertilizationTips}
                    onChange={(v) =>
                      setLocalPrefs((p) => ({ ...p, fertilizationTips: v }))
                    }
                  />
                </li>
                <li className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">Community news</p>
                    <p className="mt-1 text-sm text-muted">
                      Weekly roundup from the conservatory.
                    </p>
                  </div>
                  <Toggle
                    id="toggle-news"
                    checked={localPrefs.communityNews}
                    onChange={(v) =>
                      setLocalPrefs((p) => ({ ...p, communityNews: v }))
                    }
                  />
                </li>
              </ul>
            </section>

            <section className="rounded-[22px] bg-white p-6 shadow-soft ring-1 ring-black/[0.04] sm:p-7">
              <h2 className="flex items-center gap-2 text-lg font-bold text-forest">
                <Eye className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                Privacy
              </h2>
              <div className="mt-5 rounded-2xl bg-archive-cream p-4 sm:p-5">
                <p className="font-semibold text-ink">Public conservatory</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Allow other gardeners to view your plant collection and growth
                  timelines. Your email remains hidden.
                </p>
                <div
                  className="mt-4 inline-flex rounded-full bg-care-canvas/90 p-1 shadow-inner"
                  role="group"
                  aria-label="Public conservatory visibility"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setLocalPrefs((p) => ({ ...p, conservatory: "visible" }))
                    }
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      localPrefs.conservatory === "visible"
                        ? "bg-sage text-forest shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Visible
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLocalPrefs((p) => ({ ...p, conservatory: "private" }))
                    }
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      localPrefs.conservatory === "private"
                        ? "bg-sage text-forest shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Private
                  </button>
                </div>
              </div>
              <div className="mt-5 flex items-start justify-between gap-4 border-t border-black/[0.06] pt-5">
                <div>
                  <p className="font-semibold text-ink">Search visibility</p>
                  <p className="mt-1 text-sm text-muted">
                    Let your profile appear in conservatory search.
                  </p>
                </div>
                <Toggle
                  id="toggle-search"
                  checked={localPrefs.searchVisible}
                  onChange={(v) =>
                    setLocalPrefs((p) => ({ ...p, searchVisible: v }))
                  }
                />
              </div>
            </section>

            <div className="space-y-4 pb-8">
              {error ? (
                <p className="text-center text-sm text-alert" role="alert">
                  {error}
                </p>
              ) : null}
              {savedMsg ? (
                <p className="text-center text-sm font-medium text-forest">
                  {savedMsg}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-full bg-forest py-4 text-sm font-semibold uppercase tracking-wide text-white shadow-soft transition hover:bg-olive-dark disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={onDeleteAccount}
                className="w-full text-center text-sm font-semibold text-alert transition hover:underline"
              >
                Delete account
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
