export default function OrdersLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-neutral-200" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-[color:var(--background)]" />
      <div className="mt-8 h-9 w-full max-w-xl animate-pulse rounded-xl bg-[color:var(--background)]" />
      <div className="mt-5 h-64 animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]" />
      <p className="sr-only" role="status">
        Loading your orders…
      </p>
    </div>
  );
}
