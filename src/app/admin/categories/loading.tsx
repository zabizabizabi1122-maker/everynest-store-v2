export default function CategoriesLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="h-3 w-20 animate-pulse rounded bg-neutral-200" />
      <div className="mt-3 h-8 w-48 animate-pulse rounded-lg bg-neutral-200" />
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="h-10 w-full animate-pulse rounded-xl bg-neutral-100" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">Loading categories…</p>
    </div>
  );
}
