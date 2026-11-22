import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminNavIcon } from "@/components/admin/nav-icon";
import { ADMIN_NAV } from "@/components/admin/nav-items";
import {
  RecentOrdersTable,
  SalesOverview,
  TopProductsTable,
} from "@/components/admin/report-sections";
import { StatCard } from "@/components/admin/stat-card";
import { BrandMark } from "@/components/store/brand-mark";
import { requireStaff } from "@/lib/auth";
import { formatDecimalPaisa } from "@/lib/checkout";
import { loadReports } from "@/lib/report-data";
import { roleLabel } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const instant = false;

/**
 * Level 10 dashboard: every figure below comes from `public.get_reports_data`,
 * which reads real order and catalogue rows and enforces the Asia/Karachi
 * reporting day boundary. No invented or hard-coded business numbers.
 */
export default async function AdminDashboardPage() {
  // Supabase's token-expiry check reads Date.now(); mark this page request-bound
  // before that read so Next.js does not try to bake it into a prerendered shell.
  await connection();

  const { user, profile } = await requireStaff();
  const role = roleLabel(profile.role);
  const availableCount = ADMIN_NAV.filter((item) => item.available).length;
  const report = await loadReports(7);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight"><BrandMark variant="dark" size="md" /></h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Signed in as <span className="font-medium text-neutral-900">{user.email}</span>
          </p>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
          {role} access verified
        </span>
      </header>

      <section aria-label="Key figures" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total sales"
          value={formatDecimalPaisa(report.totalSalesPaisa)}
          hint="Verified, processing, shipped and delivered orders"
        />
        <StatCard
          label="Total orders"
          value={String(report.statusCounts.all)}
          hint={`${report.statusCounts.delivered} delivered`}
        />
        <StatCard
          label="Pending orders"
          value={String(report.statusCounts.pending)}
          hint="Waiting for admin verification"
        />
        <StatCard
          label="Low-stock variants"
          value={String(report.lowStockCount)}
          hint={`${report.activeProducts} active products`}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SalesOverview days={report.dailySales} timezone={report.timezone} compact />
        <TopProductsTable products={report.topProducts.slice(0, 5)} />
      </div>

      <div className="mt-6">
        <RecentOrdersTable orders={report.recentOrders} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <section
          aria-labelledby="your-access"
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <h2 id="your-access" className="text-lg font-semibold">
            Your access
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Email</dt>
              <dd className="mt-0.5 break-all font-medium text-neutral-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Role</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">{role}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Verified by</dt>
              <dd className="mt-0.5 font-medium text-neutral-900">auth.getUser() + profiles.role</dd>
            </div>
          </dl>

          <p className="mt-4 rounded-xl bg-neutral-50 px-3 py-2.5 text-xs leading-5 text-neutral-600">
            Roles come from <code className="font-mono">public.profiles</code> on every
            request. A cookie or form value cannot upgrade them.
          </p>
        </section>

        <section
          aria-labelledby="build-progress"
          className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm lg:col-span-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="build-progress" className="text-lg font-semibold">Build progress</h2>
            <p className="text-xs font-semibold text-neutral-500">
              {availableCount} of {ADMIN_NAV.length} screens available
            </p>
          </div>

          <ul className="mt-3 divide-y divide-neutral-100">
            {ADMIN_NAV.map((item) => (
              <li key={item.href} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex items-center gap-2.5 text-sm font-medium text-neutral-800">
                  <AdminNavIcon
                    name={item.icon}
                    className={`size-4.5 shrink-0 ${item.available ? "text-[color:var(--brand)]" : "text-neutral-400"}`}
                  />
                  {item.label}
                </span>

                {item.available ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Available now
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-500">
                    Level {item.level}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600">
        <strong className="font-semibold text-neutral-800">All figures are real.</strong>{" "}
        They come from order and catalogue rows through the staff-only reports RPC;
        sales exclude pending and cancelled orders.
      </p>
    </div>
  );
}
