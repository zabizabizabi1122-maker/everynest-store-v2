import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

import { setSupplierActiveAction } from "./actions";

export const metadata: Metadata = {
  title: "Suppliers · EveryNest",
};

export const instant = false;

interface SuppliersPageProps {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}

const PAGE_SIZE = 20;

export default async function SuppliersPage({ searchParams }: SuppliersPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  const { profile } = await requireStaff("/admin/suppliers");
  const canWrite = isAdminRole(profile.role);

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const search = (params.q ?? "").trim().slice(0, 100);
  const supabase = await createClient();

  let query = supabase
    .from("suppliers")
    .select("id, name, phone, address, is_active", { count: "exact" });

  if (search) query = query.ilike("name", `%${search}%`);

  const from = (page - 1) * PAGE_SIZE;
  const { data: suppliers, count, error } = await query
    .order("name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  function pageHref(target: number): string {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    next.set("page", String(target));
    return `/admin/suppliers?${next.toString()}`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Warehouse
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Suppliers</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            {canWrite
              ? "Manage the companies that supply your stock."
              : "Supplier details are read-only for staff; only an admin can edit them."}
          </p>
        </div>
        {canWrite ? (
          <Link href="/admin/suppliers/new" className={primaryButtonClass}>
            + New supplier
          </Link>
        ) : null}
      </header>

      {params.status === "updated" ? (
        <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Supplier status updated.
        </p>
      ) : null}
      {params.status === "error" ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          That status change could not be saved. Please try again.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load the suppliers. Check the Supabase connection and try again.
        </p>
      ) : null}

      <section aria-label="Supplier list" className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-neutral-200 p-4">
          <div className="min-w-52 flex-1">
            <label htmlFor="supplier-search" className="block text-xs font-semibold text-neutral-700">
              Search by name
            </label>
            <input
              id="supplier-search"
              name="q"
              type="search"
              defaultValue={search}
              placeholder="e.g. Textile Mills"
              className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
            />
          </div>
          <button type="submit" className={secondaryButtonClass}>Search</button>
          {search ? (
            <Link href="/admin/suppliers" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              Clear
            </Link>
          ) : null}
        </form>

        {!suppliers || suppliers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-neutral-900">No suppliers found</p>
            <p className="mt-1 text-sm text-neutral-600">
              {search ? "Try a different search term." : "Add a supplier when you start receiving stock."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Phone</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Address</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  {canWrite ? <th scope="col" className="px-5 py-3 text-right font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="transition hover:bg-neutral-50/80">
                    <td className="px-5 py-4 font-semibold text-neutral-900">
                      {canWrite ? (
                        <Link
                          href={`/admin/suppliers/${supplier.id}`}
                          className="hover:text-[color:var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
                        >
                          {supplier.name}
                        </Link>
                      ) : (
                        supplier.name
                      )}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{supplier.phone ?? "—"}</td>
                    <td className="max-w-xs truncate px-5 py-4 text-neutral-600">{supplier.address ?? "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          supplier.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {supplier.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canWrite ? (
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          <Link
                            href={`/admin/suppliers/${supplier.id}`}
                            className="text-sm font-medium text-[color:var(--brand)] hover:underline"
                          >
                            edit
                          </Link>
                          <form action={setSupplierActiveAction}>
                            <input type="hidden" name="id" value={supplier.id} />
                            <input type="hidden" name="active" value={supplier.is_active ? "false" : "true"} />
                            <button type="submit" className="text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:underline">
                              {supplier.is_active ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE ? (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 text-sm">
            <span className="text-neutral-600">Page {currentPage} of {pageCount}</span>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link href={pageHref(currentPage - 1)} className={secondaryButtonClass}>Previous</Link>
              ) : null}
              {currentPage < pageCount ? (
                <Link href={pageHref(currentPage + 1)} className={secondaryButtonClass}>Next</Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
