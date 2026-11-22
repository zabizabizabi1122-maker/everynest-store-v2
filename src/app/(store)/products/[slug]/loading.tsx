export default function ProductDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-8">
      <div className="h-3 w-64 animate-pulse rounded bg-neutral-200" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-2xl bg-[color:var(--background)]" />
        <div className="space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-neutral-200" />
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-8 w-32 animate-pulse rounded-lg bg-neutral-200" />
          <div className="h-20 w-full animate-pulse rounded-xl bg-[color:var(--background)]" />
          <div className="h-64 w-full animate-pulse rounded-2xl bg-[color:var(--background)]" />
        </div>
      </div>
      <p className="sr-only" role="status">Loading product…</p>
    </div>
  );
}
