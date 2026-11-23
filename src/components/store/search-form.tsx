/** Plain GET form so search works without client JavaScript. */
export function SearchForm({
  defaultValue = "",
  id = "store-search",
}: {
  defaultValue?: string;
  id?: string;
}) {
  return (
    <form action="/products" method="get" role="search" className="relative w-full">
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search products…"
        className="w-full rounded-full border border-[color:var(--border)] bg-[color:var(--background)]/70 py-2.5 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--primary)] focus:bg-[color:var(--surface)] focus:ring-2 focus:ring-[color:var(--primary)]/20"
      />
      <button
        type="submit"
        aria-label="Search"
        className="search-submit absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-[color:var(--primary)] text-white transition hover:bg-[color:var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
          <path d="M5 12h13M12 6l6 6-6 6" />
        </svg>
      </button>
    </form>
  );
}
