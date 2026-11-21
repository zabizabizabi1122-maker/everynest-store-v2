export default function ProductsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-10">
      <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
      <div className="mt-3 h-8 w-52 animate-pulse rounded-lg bg-neutral-200" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-neutral-100" />
        <div>
          <div className="h-4 w-48 animate-pulse rounded bg-neutral-200" />
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <div key={cell} className="overflow-hidden rounded-2xl border border-neutral-200">
                <div className="aspect-square animate-pulse bg-neutral-100" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-16 animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-neutral-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">Loading products…</p>
    </div>
  );
}
