export default function TripLoading() {
  return (
    <div aria-busy="true" aria-label="Loading trip">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="h-3 w-10 animate-pulse rounded bg-cream-200" />
          <div className="mt-2 h-7 w-64 animate-pulse rounded-md bg-cream-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded-md bg-cream-200" />
        </div>
        <div className="h-6 w-20 animate-pulse rounded-full bg-cream-200" />
      </div>

      <div className="mt-8 h-9 w-80 max-w-full animate-pulse rounded-full bg-cream-200" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-forest-900/[0.08] bg-white" />
        ))}
      </div>

      <div className="mt-6 h-64 animate-pulse rounded-2xl border border-forest-900/[0.06] bg-white" />
    </div>
  );
}
