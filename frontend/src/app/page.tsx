import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-cream px-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-ink">
          BloomIQ
        </h1>
        <p className="mt-3 max-w-md text-muted">
          Plant care backend + web app. Sign in to continue.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/login"
          className="rounded-full bg-olive px-8 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-olive-dark"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-stone-300 bg-white px-8 py-3 text-sm font-semibold text-ink transition hover:bg-stone-50"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
