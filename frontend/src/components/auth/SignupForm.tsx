"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import { IconLock, IconMail, IconUser } from "./icons";

type UserPayload = {
  _id: string;
  name: string;
  email: string;
};

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("Please agree to the terms to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost<UserPayload>("/api/auth/signup", {
        name,
        email,
        password,
      });
      if (!res.success) {
        setError(res.error || res.message);
        return;
      }
      router.push("/login?registered=1");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-[2rem] bg-white p-8 shadow-card sm:p-10 md:p-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">
          Join BloomIQ
        </h1>
        <p className="mt-2 text-sm text-muted">
          Start your botanical journey today.
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
            htmlFor="signup-name"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            Full name
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <IconUser className="text-muted" />
            </span>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-full border-0 bg-input-deep py-3.5 pl-12 pr-5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/30"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            Email
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <IconMail className="text-muted" />
            </span>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="hello@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border-0 bg-input-deep py-3.5 pl-12 pr-5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/30"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="signup-password"
            className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
          >
            Create password
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <IconLock className="text-muted" />
            </span>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border-0 bg-input-deep py-3.5 pl-12 pr-5 text-sm text-ink placeholder:text-muted/70 focus:bg-white focus:ring-2 focus:ring-olive/30"
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-olive focus:ring-olive"
          />
          <span>
            I agree to the{" "}
            <Link href="#" className="font-medium text-olive hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="#" className="font-medium text-olive hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-olive py-3.5 text-sm font-semibold text-white shadow-soft transition hover:bg-olive-dark disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-olive hover:text-olive-dark"
        >
          Sign In
        </Link>
      </p>
    </div>
  );
}
