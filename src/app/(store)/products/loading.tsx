export default function ProductsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6">
      <div className="h-3 w-24 animate-pulse rounded bg-[color:var(--border)]" />
      <div className="mt-3 h-8 w-52 animate-pulse rounded-lg bg-[color:var(--border)]" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-[color:var(--border)]" />
      <div className="mt-8 h-4 w-48 animate-pulse rounded bg-[color:var(--border)]" />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => (
          <div key={cell} className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]">
            <div className="aspect-[4/5] animate-pulse bg-[color:var(--background)]" />
            <div className="space-y-2 p-3.5">
              <div className="h-4 w-full animate-pulse rounded bg-[color:var(--border)]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[color:var(--border)]" />
              <div className="h-9 w-full animate-pulse rounded-[10px] bg-[color:var(--border)]" />
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only" role="status">Loading products…</p>
    </div>
  );
}
