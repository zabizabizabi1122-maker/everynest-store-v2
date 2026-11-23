export default function SettingsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl" aria-busy="true" aria-label="Loading website settings">
      <div className="h-3 w-32 animate-pulse rounded bg-neutral-200" />
      <div className="mt-3 h-9 w-64 animate-pulse rounded bg-neutral-200" />
      <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-neutral-100" />

      <div className="mt-8 space-y-6">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-48 animate-pulse rounded bg-neutral-200" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
              <div className="h-10 animate-pulse rounded-lg bg-neutral-100" />
              <div className="h-10 animate-pulse rounded-lg bg-neutral-100 sm:col-span-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
