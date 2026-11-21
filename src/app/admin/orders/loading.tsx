export default function AdminOrdersLoading() {
  return (
    <div>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-200" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded bg-neutral-100" />
      <div className="mt-6 h-9 w-full max-w-xl animate-pulse rounded-xl bg-neutral-100" />
      <div className="mt-5 h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
      <p className="sr-only" role="status">
        Loading orders…
      </p>
    </div>
  );
}
