"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";

type Props = {
  token: string;
};

export function ResetPasswordForm({ token }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedToken = token.trim();
  const tokenMissing = !trimmedToken;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost<{ ok: boolean }>("/api/auth/reset-password", {
        token: trimmedToken,
        password,
      });
      if (!res.success) {
        setError(res.error || res.message);
        return;
      }
      router.push("/login?reset=1");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (tokenMissing) {
    return (
      <div className="w-full max-w-md rounded-[2rem] bg-white p-10 shadow-card md:p-12">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Invalid link
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This page needs a reset token from your email. Open the link from your
          inbox, or request a new reset email.
        </p>
        <Link
          href="/forgot-password"
          className="mt-8 block w-full rounded-full bg-olive py-3.5 text-center text-sm font-semibold text-white shadow-soft transition hover:bg-olive-dark"
        >
          Request new link
        </Link>
        <Link
          href="/login"
          className="mt-4 block text-center text-sm font-semibold text-olive hover:text-olive-dark"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] bg-white p-10 shadow-card md:p-12">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          New password
        </h1>
        <p className="mt-2 text-sm text-muted">
          Choose a strong password you haven&apos;t used here before.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error ? (
          <p
            className="rounded-full bg-red-50 px-4 py-2 text-center text-sm text-red-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div>
          <label
            htmlFor="reset-password"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            New password
          </label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-full border-0 bg-input-deep px-5 py-3.5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/30"
          />
        </div>

        <div>
          <label
            htmlFor="reset-confirm"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            Confirm password
          </label>
          <input
            id="reset-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-full border-0 bg-input-deep px-5 py-3.5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/30"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-olive py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-olive-dark disabled:opacity-60"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>

      <p className="mt-10 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-olive hover:text-olive-dark">
          Cancel and sign in
        </Link>
      </p>
    </div>
  );
}
