export default function AdminsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-[color:var(--border)]" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-[color:var(--border)]" />
      <div className="mt-8 h-24 animate-pulse rounded-2xl border border-[color:var(--border)] bg-white" />
      <div className="mt-6 h-96 animate-pulse rounded-2xl border border-[color:var(--border)] bg-white" />
    </div>
  );
}
