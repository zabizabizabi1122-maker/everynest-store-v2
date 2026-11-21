import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth";
import { loadCategoryTree } from "@/lib/category-data";
import { formatPkr } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { setProductActiveAction } from "./actions";

export const metadata: Metadata = {
  title: "Products · EveryNest",
};

export const instant = false;

interface ProductsPageProps {
  searchParams: Promise<{ page?: string; q?: string; category?: string; status?: string }>;
}

const PAGE_SIZE = 20;

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/products");

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = (params.q ?? "").trim().slice(0, 100);
  const categoryFilter = (params.category ?? "").trim().slice(0, 40);
  const supabase = await createClient();

  let listQuery = supabase
    .from("products")
    .select("id, name, slug, category_id, is_active, is_featured, updated_at", { count: "exact" });

  if (search) listQuery = listQuery.ilike("name", `%${search}%`);
  if (categoryFilter) listQuery = listQuery.eq("category_id", categoryFilter);

  const from = (page - 1) * PAGE_SIZE;
  const { data: products, count, error } = await listQuery
    .order("name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const categories = await loadCategoryTree();
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const productIds = (products ?? []).map((product) => product.id);
  const summaries = new Map<string, { variants: number; price: number | null; stock: number }>();

  if (productIds.length > 0) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("product_id, price_paisa, sale_price_paisa, stock")
      .in("product_id", productIds);

    for (const variant of variants ?? []) {
      const summary = summaries.get(variant.product_id) ?? { variants: 0, price: null, stock: 0 };
      const effective = variant.sale_price_paisa ?? variant.price_paisa;

      summary.variants += 1;
      summary.stock += variant.stock;
      summary.price = summary.price === null ? effective : Math.min(summary.price, effective);
      summaries.set(variant.product_id, summary);
    }
  }

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  function pageHref(target: number): string {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (categoryFilter) next.set("category", categoryFilter);
    next.set("page", String(target));
    return `/admin/products?${next.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Catalogue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Manage product details, variants, prices and gallery images. Stock is handled in Inventory.
          </p>
        </div>
        <Link href="/admin/products/new" className={primaryButtonClass}>
          + New product
        </Link>
      </header>

      {params.status === "updated" ? (
        <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Product status updated.
        </p>
      ) : null}
      {params.status === "error" ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          That status change could not be saved. Please try again.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load the products. Check the Supabase connection and try again.
        </p>
      ) : null}

      <section aria-label="Product list" className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-neutral-200 p-4">
          <div className="min-w-52 flex-1">
            <label htmlFor="product-search" className="block text-xs font-semibold text-neutral-700">
              Search by name
            </label>
            <input
              id="product-search"
              name="q"
              type="search"
              defaultValue={search}
              placeholder="e.g. Cotton Shirt"
              className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
            />
          </div>
          <div className="min-w-44">
            <label htmlFor="product-category" className="block text-xs font-semibold text-neutral-700">
              Category
            </label>
            <select
              id="product-category"
              name="category"
              defaultValue={categoryFilter}
              className="mt-1 block w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={secondaryButtonClass}>
            Filter
          </button>
          {search || categoryFilter ? (
            <Link href="/admin/products" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              Clear
            </Link>
          ) : null}
        </form>

        {!products || products.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-neutral-900">No products found</p>
            <p className="mt-1 text-sm text-neutral-600">
              {search || categoryFilter ? "Try different filters." : "Create your first product to start the catalogue."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Product</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Category</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Variants</th>
                  <th scope="col" className="px-5 py-3 font-semibold">From price</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Stock</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {products.map((product) => {
                  const summary = summaries.get(product.id);

                  return (
                    <tr key={product.id} className="transition hover:bg-neutral-50/80">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="font-semibold text-neutral-900 hover:text-[color:var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                        >
                          {product.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-neutral-500">/{product.slug}</p>
                        {product.is_featured ? (
                          <span className="mt-1 inline-block rounded-full bg-[color:var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--brand)]">
                            Featured
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        {categoryNames.get(product.category_id) ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{summary?.variants ?? 0}</td>
                      <td className="px-5 py-4 text-neutral-600">
                        {summary?.price === null || summary?.price === undefined ? "—" : formatPkr(summary.price)}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{summary?.stock ?? 0}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            product.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {product.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="text-sm font-medium text-[color:var(--brand)] hover:underline"
                          >
                            edit
                          </Link>
                          <form action={setProductActiveAction}>
                            <input type="hidden" name="id" value={product.id} />
                            <input type="hidden" name="active" value={product.is_active ? "false" : "true"} />
                            <button type="submit" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:underline">
                              {product.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE ? (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 text-sm">
            <span className="text-neutral-600">
              Page {currentPage} of {pageCount}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className={secondaryButtonClass}>
                  Previous
                </Link>
              ) : null}
              {currentPage < pageCount ? (
                <Link href={pageHref(currentPage + 1)} className={secondaryButtonClass}>
                  Next
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
