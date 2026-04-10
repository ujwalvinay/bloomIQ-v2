import Link from "next/link";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-16">
      <div className="mx-auto max-w-lg rounded-[2rem] bg-white p-10 text-center shadow-card">
        <h1 className="text-2xl font-semibold text-ink">You&apos;re in</h1>
        <p className="mt-3 text-sm text-muted">
          Dashboard shell—hook up plants and tasks here next.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block text-sm font-semibold text-olive hover:text-olive-dark"
        >
          Back to login
        </Link>
      </div>
    </main>
  );
}
