export default function InventoryLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="h-3 w-20 animate-pulse rounded bg-neutral-200" />
      <div className="mt-3 h-8 w-40 animate-pulse rounded-lg bg-neutral-200" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((card) => (
          <div key={card} className="h-28 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
        ))}
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
      <p className="sr-only" role="status">Loading inventory…</p>
    </div>
  );
}
