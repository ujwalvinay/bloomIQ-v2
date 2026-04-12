"use client";

import Link from "next/link";
import { useState } from "react";
import { apiPost } from "@/lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<{ ok: boolean }>("/api/auth/forgot-password", {
        email: email.trim(),
      });
      if (!res.success) {
        setError(res.error || res.message);
        return;
      }
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] bg-white p-10 shadow-card md:p-12">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-muted">
          Enter the email you use for BloomIQ. We&apos;ll send a link to choose a
          new password.
        </p>
      </div>

      {done ? (
        <div className="space-y-6">
          <p
            className="rounded-2xl bg-olive/10 px-4 py-4 text-center text-sm leading-relaxed text-olive-dark"
            role="status"
          >
            If an account exists for that email, we&apos;ve sent reset instructions.
            Check your inbox and spam folder.
          </p>
          <Link
            href="/login"
            className="block w-full rounded-full bg-olive py-3.5 text-center text-sm font-semibold text-white shadow-soft transition hover:bg-olive-dark"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
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
              htmlFor="forgot-email"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Email address
            </label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="curator@bloomiq.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border-0 bg-input-deep px-5 py-3.5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-olive py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-olive-dark disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="mt-10 text-center text-sm text-muted">
        Remember your password?{" "}
        <Link
          href="/login"
          className="font-semibold text-olive hover:text-olive-dark"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
