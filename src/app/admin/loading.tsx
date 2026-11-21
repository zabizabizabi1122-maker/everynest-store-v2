/**
 * Creates the request-time Suspense boundary for every admin page.
 *
 * Admin pages call `requireStaff()` / `requireAdmin()` at the top level. Those
 * helpers verify the Supabase token with `auth.getUser()`, which reads
 * `Date.now()` internally. With Cache Components that clock read must not run
 * while Next prerenders the static shell, so each page streams in behind this
 * boundary instead of being baked into prerendered HTML.
 *
 * Keep this fallback deterministic: no cookies, clock, or random values.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading admin page">
        <div className="h-4 w-24 rounded bg-neutral-200" />
        <div className="h-8 w-64 rounded bg-neutral-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 rounded-2xl border border-neutral-200 bg-white" />
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}
