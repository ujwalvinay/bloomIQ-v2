export default function DashboardPage() {
  return (
    <main className="p-8 lg:p-10">
      <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
      <p className="mt-2 max-w-lg text-sm text-muted">
        Overview of plants, tasks, and care—wire this to your API when you&apos;re
        ready.
      </p>
      <div className="mt-10 rounded-[1.5rem] border border-stone-200/80 bg-white p-10 shadow-sm">
        <p className="text-sm text-muted">
          You&apos;re signed in. Use the sidebar to explore sections as you build
          them out.
        </p>
      </div>
    </main>
  );
}
