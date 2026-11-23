import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { secondaryButtonClass } from "@/components/ui/form";
import { requirePermission } from "@/lib/auth";
import { loadCustomerList } from "@/lib/customer-data";
import {
  CUSTOMER_PAGE_SIZE,
  parseCustomerPage,
  parseCustomerRole,
  sanitizeCustomerSearch,
  type CustomerListResult,
  type CustomerRole,
} from "@/lib/customers";
import { roleLabel } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Customers · EveryNest Admin",
};

export const instant = false;

interface AdminCustomersPageProps {
  searchParams: Promise<{ page?: string; q?: string; role?: string }>;
}

const ROLE_FILTERS: ReadonlyArray<{
  value: CustomerRole | null;
  label: string;
}> = [
  { value: null, label: "All accounts" },
  { value: "customer", label: "Customers" },
  { value: "admin", label: "Admins" },
  { value: "super_admin", label: "Super Admins" },
];

function customersHref(
  page: number,
  search: string,
  role: CustomerRole | null,
): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (role) params.set("role", role);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}

function formatJoined(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(date);
}

function roleBadgeClass(role: CustomerRole): string {
  if (role === "super_admin") return "bg-purple-50 text-purple-700";
  if (role === "admin") return "bg-amber-50 text-amber-700";
  return "bg-neutral-100 text-neutral-600";
}

export default async function AdminCustomersPage({
  searchParams,
}: AdminCustomersPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("customers.view", "/admin/customers");

  const params = await searchParams;
  const search = sanitizeCustomerSearch(params.q);
  const role = parseCustomerRole(params.role);
  const page = parseCustomerPage(params.page);

  let result: CustomerListResult | null = null;
  let loadError = false;
  try {
    result = await loadCustomerList({ page, search, role });
  } catch {
    // Technical details are logged server-side in the data layer; the page
    // only shows a friendly message.
    loadError = true;
  }

  const total = result?.total ?? 0;
  const pageCount = result?.pageCount ?? 1;
  const currentPage = Math.min(page, pageCount);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Customer care
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Read-only account directory. Roles are managed in the database, not here.
          </p>
        </div>
        <Link href="/admin" className={secondaryButtonClass}>
          Back to dashboard
        </Link>
      </header>

      <nav
        aria-label="Filter accounts by role"
        className="mt-6 flex flex-wrap gap-2"
      >
        {ROLE_FILTERS.map((filter) => {
          const active = role === filter.value;
          return (
            <Link
              key={filter.label}
              href={customersHref(1, search, filter.value)}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-[color:var(--brand)] text-white"
                  : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <section className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-neutral-200 p-4">
          {role ? (
            <input type="hidden" name="role" value={role} />
          ) : null}
          <div className="min-w-52 flex-1">
            <label
              htmlFor="customer-search"
              className="block text-xs font-semibold text-neutral-700"
            >
              Search by name, email or phone
            </label>
            <input
              id="customer-search"
              name="q"
              type="search"
              defaultValue={search}
              maxLength={100}
              placeholder="e.g. Ahmed or +92300"
              className="mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[color:var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
          >
            Search
          </button>
          {search ? (
            <Link
              href={customersHref(1, "", role)}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {loadError ? (
          <p role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            We could not load customers. Check the Supabase connection and try again.
          </p>
        ) : !result || result.customers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-neutral-900">No accounts found</p>
            <p className="mt-1 text-sm text-neutral-600">
              {search || role
                ? "Try a different search term or role filter."
                : "Accounts appear here after customers sign up."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Phone</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {result.customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-neutral-50/80"
                  >
                    <td className="px-5 py-4 font-medium text-neutral-900">
                      {customer.fullName}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {customer.phone ?? "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${roleBadgeClass(customer.role)}`}
                      >
                        {roleLabel(customer.role)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {formatJoined(customer.joinedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loadError && total > CUSTOMER_PAGE_SIZE ? (
        <nav
          aria-label="Customers pagination"
          className="mt-5 flex items-center justify-between gap-3 text-sm"
        >
          <Link
            href={customersHref(Math.max(1, currentPage - 1), search, role)}
            aria-disabled={currentPage <= 1}
            className={`${secondaryButtonClass} ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <span className="text-neutral-600">
            Page {currentPage} of {pageCount} · {total} accounts
          </span>
          <Link
            href={customersHref(Math.min(pageCount, currentPage + 1), search, role)}
            aria-disabled={currentPage >= pageCount}
            className={`${secondaryButtonClass} ${currentPage >= pageCount ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
