import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/store/product-card";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { loadProductListing, loadPublicCategories } from "@/lib/catalog";
import {
  clampPage,
  PAGE_SIZE,
  parsePaisaFilter,
  parsePositiveInt,
  parseSort,
  sanitizeSearch,
  SORT_LABELS,
  SORT_OPTIONS,
} from "@/lib/storefront";
import { uuidSchema } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Products · EveryNest",
  description: "Browse the EveryNest catalogue with filters and search.",
};

interface ProductsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    min?: string;
    max?: string;
    stock?: string;
    sort?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  const q = sanitizeSearch(params.q);
  const categoryId = params.category && uuidSchema.safeParse(params.category).success ? params.category : "";
  const parsedMin = parsePaisaFilter(params.min);
  const parsedMax = parsePaisaFilter(params.max);
  // A reversed range is almost always a typo; treat it as an unordered range
  // instead of silently showing an empty catalogue.
  const minPaisa = parsedMin !== null && parsedMax !== null && parsedMin > parsedMax ? parsedMax : parsedMin;
  const maxPaisa = parsedMin !== null && parsedMax !== null && parsedMin > parsedMax ? parsedMin : parsedMax;
  const inStockOnly = params.stock === "1";
  const sort = parseSort(params.sort);

  const [categories, initialResult] = await Promise.all([
    loadPublicCategories(),
    loadProductListing({
      q,
      categoryId,
      minPaisa,
      maxPaisa,
      inStockOnly,
      sort,
      page: parsePositiveInt(params.page, 1),
    }),
  ]);

  const page = clampPage(initialResult.page, initialResult.pageCount);
  const result =
    page === initialResult.page
      ? initialResult
      : await loadProductListing({ q, categoryId, minPaisa, maxPaisa, inStockOnly, sort, page });

  function pageHref(target: number): string {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (categoryId) search.set("category", categoryId);
    if (params.min) search.set("min", params.min);
    if (params.max) search.set("max", params.max);
    if (inStockOnly) search.set("stock", "1");
    if (sort !== "newest") search.set("sort", sort);
    search.set("page", String(target));
    return `/products?${search.toString()}`;
  }

  const from = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 pb-20 pt-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">All products</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Search, filter and compare the active catalogue.
        </p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside aria-labelledby="filters-heading">
          <form action="/products" method="get" className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 id="filters-heading" className="text-base font-semibold">Filters</h2>

            <div className="mt-5">
              <label htmlFor="filter-q" className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Search
              </label>
              <input
                id="filter-q"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Product name…"
                className={inputClass}
              />
            </div>

            <div className="mt-4">
              <label htmlFor="filter-category" className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Category
              </label>
              <select id="filter-category" name="category" defaultValue={categoryId} className={inputClass}>
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.parentId ? "↳ " : ""}{category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="filter-min" className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Min (Rs.)
                </label>
                <input
                  id="filter-min"
                  type="number"
                  name="min"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={params.min ?? ""}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="filter-max" className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
                  Max (Rs.)
                </label>
                <input
                  id="filter-max"
                  type="number"
                  name="max"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  defaultValue={params.max ?? ""}
                  placeholder="Any"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2.5 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="stock"
                  value="1"
                  defaultChecked={inStockOnly}
                  className="size-4 rounded border-neutral-300 accent-[color:var(--brand)]"
                />
                In stock only
              </label>
            </div>

            <div className="mt-4">
              <label htmlFor="filter-sort" className="block text-xs font-semibold uppercase tracking-wide text-neutral-600">
                Sort by
              </label>
              <select id="filter-sort" name="sort" defaultValue={sort} className={inputClass}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className={`mt-5 w-full ${primaryButtonClass}`}>
              Apply filters
            </button>
            <Link href="/products" className={`mt-2 block text-center ${secondaryButtonClass}`}>
              Clear filters
            </Link>
          </form>
        </aside>

        <section aria-label="Product results">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm text-neutral-600">
              {result.total === 0
                ? "No products found"
                : `Showing ${from}–${to} of ${result.total} ${result.total === 1 ? "product" : "products"}`}
            </p>
            <p className="text-xs text-neutral-500">Sorted by {SORT_LABELS[sort].toLowerCase()}</p>
          </div>

          {result.products.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-16 text-center">
              <h2 className="text-lg font-semibold">Nothing matched your filters</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                Try a different search term, another category or a wider price range.
              </p>
              <Link href="/products" className={`mt-5 inline-flex ${primaryButtonClass}`}>
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {result.products.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 3} />
              ))}
            </div>
          )}

          {result.pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={pageHref(Math.max(1, result.page - 1))}
                aria-disabled={result.page <= 1}
                className={`${secondaryButtonClass} ${result.page <= 1 ? "pointer-events-none opacity-50" : ""}`}
              >
                Previous
              </Link>
              {Array.from({ length: result.pageCount }, (_, index) => index + 1).map((target) => (
                <Link
                  key={target}
                  href={pageHref(target)}
                  aria-current={target === result.page ? "page" : undefined}
                  className={`inline-flex size-10 items-center justify-center rounded-xl text-sm font-semibold transition ${
                    target === result.page
                      ? "bg-[color:var(--brand)] text-white"
                      : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {target}
                </Link>
              ))}
              <Link
                href={pageHref(Math.min(result.pageCount, result.page + 1))}
                aria-disabled={result.page >= result.pageCount}
                className={`${secondaryButtonClass} ${result.page >= result.pageCount ? "pointer-events-none opacity-50" : ""}`}
              >
                Next
              </Link>
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
