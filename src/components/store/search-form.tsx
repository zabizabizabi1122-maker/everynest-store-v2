/** Plain GET form so search works without client JavaScript. */
export function SearchForm({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/products" method="get" role="search" className="relative w-full sm:w-64">
      <label htmlFor="store-search" className="sr-only">
        Search products
      </label>
      <input
        id="store-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search products…"
        className="w-full rounded-xl border border-neutral-300 bg-white py-2 pl-3.5 pr-10 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-[color:var(--brand)]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-4">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
