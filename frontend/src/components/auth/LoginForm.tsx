"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import { IconApple, IconGoogle } from "./icons";

type UserPayload = {
  _id: string;
  name: string;
  email: string;
};

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialHint, setSocialHint] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<UserPayload>("/api/auth/login", {
        email,
        password,
      });
      if (!res.success || !res.data) {
        setError(res.error || res.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] bg-white p-10 shadow-card md:p-12">
      <div className="mb-8 text-center md:text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Welcome Back
        </h1>
        <p className="mt-2 text-sm text-muted">
          Continue your botanical journey.
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
            htmlFor="login-email"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            Email address
          </label>
          <input
            id="login-email"
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

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label
              htmlFor="login-password"
              className="text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-olive hover:text-olive-dark"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-full border-0 bg-input-deep px-5 py-3.5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/30"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-olive py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-olive-dark disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      {socialHint ? (
        <p className="mt-4 text-center text-xs text-muted">{socialHint}</p>
      ) : null}

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-white px-4 text-muted">or</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white py-3 text-sm font-medium text-ink transition hover:bg-stone-50"
          onClick={() =>
            setSocialHint("Google sign-in is not wired yet for BloomIQ.")
          }
        >
          <IconGoogle />
          Google
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white py-3 text-sm font-medium text-ink transition hover:bg-stone-50"
          onClick={() =>
            setSocialHint("Apple sign-in is not wired yet for BloomIQ.")
          }
        >
          <IconApple />
          Apple
        </button>
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        New to BloomIQ?{" "}
        <Link
          href="/signup"
          className="font-semibold text-olive hover:text-olive-dark"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
