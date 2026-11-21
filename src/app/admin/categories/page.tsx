import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { setCategoryActiveAction } from "./actions";

export const metadata: Metadata = {
  title: "Categories · EveryNest",
};

export const instant = false;

interface CategoriesPageProps {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}

const PAGE_SIZE = 20;

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/categories");

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = (params.q ?? "").trim().slice(0, 100);
  const supabase = await createClient();

  let listQuery = supabase
    .from("categories")
    .select("id, name, slug, parent_id, attribute_schema, is_active, updated_at", { count: "exact" });

  if (search) {
    listQuery = listQuery.ilike("name", `%${search}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: categories, count, error } = await listQuery
    .order("name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const { data: allCategories } = await supabase.from("categories").select("id, name");
  const names = new Map((allCategories ?? []).map((category) => [category.id, category.name]));

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  function pageHref(target: number): string {
    const searchParams = new URLSearchParams();
    if (search) searchParams.set("q", search);
    searchParams.set("page", String(target));
    return `/admin/categories?${searchParams.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Catalogue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Organize products into parent and child groups, and define the attributes their
            variants require.
          </p>
        </div>
        <Link href="/admin/categories/new" className={primaryButtonClass}>
          + New category
        </Link>
      </header>

      {params.status === "updated" ? (
        <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Category status updated.
        </p>
      ) : null}
      {params.status === "error" ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          That status change could not be saved. Please try again.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load the categories. Check the Supabase connection and try again.
        </p>
      ) : null}

      <section aria-label="Category list" className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-neutral-200 p-4">
          <div className="min-w-52 flex-1">
            <label htmlFor="category-search" className="block text-xs font-semibold text-neutral-700">
              Search by name
            </label>
            <input
              id="category-search"
              name="q"
              type="search"
              defaultValue={search}
              placeholder="e.g. Shoes"
              className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
            />
          </div>
          <button type="submit" className={secondaryButtonClass}>
            Search
          </button>
          {search ? (
            <Link href="/admin/categories" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              Clear
            </Link>
          ) : null}
        </form>

        {!categories || categories.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-neutral-900">No categories found</p>
            <p className="mt-1 text-sm text-neutral-600">
              {search ? "Try a different search term." : "Create your first category to start the catalogue."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Parent</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Attributes</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {categories.map((category) => {
                  const countAttributes = Array.isArray(category.attribute_schema)
                    ? category.attribute_schema.length
                    : 0;

                  return (
                    <tr key={category.id} className="transition hover:bg-neutral-50/80">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/categories/${category.id}`}
                          className="font-semibold text-neutral-900 hover:text-[color:var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                        >
                          {category.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-neutral-500">/{category.slug}</p>
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        {category.parent_id ? (names.get(category.parent_id) ?? "—") : "Top level"}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{countAttributes}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            category.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {category.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/admin/categories/${category.id}`}
                            className="text-sm font-medium text-[color:var(--brand)] hover:underline"
                          >
                            Edit
                          </Link>
                          <form action={setCategoryActiveAction}>
                            <input type="hidden" name="id" value={category.id} />
                            <input type="hidden" name="active" value={category.is_active ? "false" : "true"} />
                            <button type="submit" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:underline">
                              {category.is_active ? "Deactivate" : "Activate"}
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
