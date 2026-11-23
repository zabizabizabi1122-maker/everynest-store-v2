import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";
import { primaryButtonClass } from "@/components/ui/form";
import { requirePermission } from "@/lib/auth";
import { loadFilterConfig } from "@/lib/filters";
import { createClient } from "@/lib/supabase/server";

import { deleteFilterAction, setFilterActiveAction } from "./actions";

export const metadata: Metadata = {
  title: "Filters · EveryNest",
};

export const instant = false;

interface FiltersPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function FiltersPage({ searchParams }: FiltersPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("filters.view", "/admin/filters");

  const { status } = await searchParams;
  const supabase = await createClient();
  const [config, categoriesResult] = await Promise.all([
    loadFilterConfig({ includeInactive: true }),
    supabase.from("categories").select("id, name").order("name", { ascending: true }),
  ]);

  const categoryNames = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]));
  const optionCounts = new Map<string, number>();
  for (const option of config.options) {
    optionCounts.set(option.filterId, (optionCounts.get(option.filterId) ?? 0) + 1);
  }

  const definitions = config.definitions
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder || left.label.localeCompare(right.label));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Website
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Storefront filters</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Choose which filters customers see, set their options and assign them to categories.
          </p>
        </div>
        <Link href="/admin/filters/new" className={primaryButtonClass}>
          + New filter
        </Link>
      </header>

      {status === "updated" ? (
        <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Filter status updated.
        </p>
      ) : null}
      {status === "deleted" ? (
        <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Filter deleted.
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          That change could not be saved. Please try again.
        </p>
      ) : null}
      {categoriesResult.error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load all category assignments. Check the Supabase connection and try again.
        </p>
      ) : null}

      <section aria-label="Filter list" className="mt-8 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-white shadow-sm">
        {definitions.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-neutral-900">No filters configured</p>
            <p className="mt-1 text-sm text-neutral-600">
              Create a filter definition to show real catalogue choices on /products.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[color:var(--background)] text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Filter</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Type</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Categories</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Options</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Order</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border)]/70">
                {definitions.map((definition) => {
                  const assigned = definition.categoryIds.map((id) => categoryNames.get(id) ?? "Unknown");
                  return (
                    <tr key={definition.id} className="transition hover:bg-[color:var(--background)]">
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/filters/${definition.id}`}
                          className="font-semibold text-neutral-900 hover:text-[color:var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                        >
                          {definition.label}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-neutral-500">{definition.key}</p>
                        {definition.description ? (
                          <p className="mt-1 max-w-xs text-xs text-neutral-500">{definition.description}</p>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{definition.type.replace(/_/g, " ")}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            definition.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {definition.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-neutral-600">
                        {definition.appliesToAll
                          ? "All categories"
                          : assigned.length > 0
                            ? assigned.join(", ")
                            : "Not assigned"}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{optionCounts.get(definition.id) ?? 0}</td>
                      <td className="px-5 py-4 text-neutral-600">{definition.displayOrder}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <Link
                            href={`/admin/filters/${definition.id}`}
                            className="text-sm font-medium text-[color:var(--brand)] hover:underline"
                          >
                            Edit
                          </Link>
                          <form action={setFilterActiveAction}>
                            <input type="hidden" name="id" value={definition.id} />
                            <input type="hidden" name="active" value={definition.isActive ? "false" : "true"} />
                            <button type="submit" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:underline">
                              {definition.isActive ? "Disable" : "Enable"}
                            </button>
                          </form>
                          <form action={deleteFilterAction}>
                            <input type="hidden" name="id" value={definition.id} />
                            <ConfirmDeleteButton
                              label="Delete"
                              confirmText={`Permanently delete ${definition.label}? This cannot be undone.`}
                            />
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
      </section>
    </div>
  );
}
