/** Plain GET form so search works without client JavaScript. */
export function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/products" method="get" role="search" className="relative w-full">
      <label htmlFor="store-search" className="sr-only">
        Search products
      </label>
      <input
        id="store-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search products…"
        className="w-full rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] py-2 pl-3.5 pr-10 text-sm text-foreground outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-[10px] p-1.5 text-[color:var(--muted)] transition hover:bg-[color:var(--background)] hover:text-[color:var(--primary)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
