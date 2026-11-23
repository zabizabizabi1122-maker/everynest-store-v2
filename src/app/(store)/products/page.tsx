import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/store/product-card";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { loadProductListing, loadPublicCategories } from "@/lib/catalog";
import {
  loadFilterConfig,
  parseProductsParams,
  productsHref,
  type RawSearchParams,
} from "@/lib/filters";
import { clampPage, PAGE_SIZE } from "@/lib/storefront";

export const metadata: Metadata = {
  title: "Products · EveryNest",
  description: "Browse the EveryNest catalogue.",
};

interface ProductsPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const [config, categories] = await Promise.all([
    loadFilterConfig(),
    loadPublicCategories(),
  ]);
  const selection = parseProductsParams(params, config, categories);

  const listingQuery = {
    q: selection.q,
    categoryId: selection.categoryIds[0] ?? "",
    categoryIds: selection.categoryIds,
    minPaisa: selection.minPaisa,
    maxPaisa: selection.maxPaisa,
    inStockOnly: selection.inStockOnly,
    sort: selection.sort,
    page: selection.page,
    filters: selection.criteria,
  };

  const initialResult = await loadProductListing(listingQuery);
  const page = clampPage(initialResult.page, initialResult.pageCount);
  const result =
    page === initialResult.page
      ? initialResult
      : await loadProductListing({ ...listingQuery, page });

  function pageHref(target: number): string {
    return productsHref(params, { page: String(target) });
  }

  const from = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(result.page * PAGE_SIZE, result.total);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">
          Catalogue
        </p>
        <h1 className="mt-2 font-heading text-[28px] font-semibold tracking-tight lg:text-[32px]">All products</h1>
        <p className="mt-2 max-w-[68ch] text-base leading-relaxed text-[color:var(--muted)]">
          Browse everything currently available at EveryNest.
        </p>
      </header>

      <div className="mt-8">
        <section aria-label="Product results" className="min-w-0">
          <p aria-live="polite" className="text-sm text-[color:var(--muted)]">
            {result.total === 0
              ? "No products found"
              : `Showing ${from}–${to} of ${result.total} ${result.total === 1 ? "product" : "products"}`}
          </p>

          {result.products.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-16 text-center">
              <h2 className="font-heading text-lg font-semibold">Nothing here yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--muted)]">
                Try the full catalogue or head back to the homepage.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/products" className={`inline-flex ${primaryButtonClass}`}>
                  Browse all products
                </Link>
                <Link href="/" className={`inline-flex ${secondaryButtonClass}`}>
                  Back to home
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5">
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
                  className={`inline-flex size-10 items-center justify-center rounded-[10px] text-sm font-semibold transition ${
                    target === result.page
                      ? "bg-[color:var(--primary)] text-white"
                      : "border border-[color:var(--border)] bg-[color:var(--surface)] text-foreground hover:bg-[color:var(--background)]"
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
