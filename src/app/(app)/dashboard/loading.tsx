export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your dashboard">
      <div className="h-7 w-56 animate-pulse rounded-md bg-cream-200" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded-md bg-cream-200" />

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-forest-900/[0.08] bg-cream-100" />
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl border border-forest-900/[0.06] bg-white" />
        ))}
      </div>
    </div>
  );
}
