export default function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-200" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded bg-[color:var(--background)]" />

      <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="mt-6 space-y-4">
          <div className="h-10 w-full animate-pulse rounded-xl bg-[color:var(--background)]" />
          <div className="h-10 w-full animate-pulse rounded-xl bg-[color:var(--background)]" />
          <div className="h-10 w-36 animate-pulse rounded-xl bg-neutral-200" />
        </div>
      </div>

      <p className="sr-only" role="status">
        Loading your account…
      </p>
    </div>
  );
}
