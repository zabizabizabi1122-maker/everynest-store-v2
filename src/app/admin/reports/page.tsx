import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import {
  LowStockTable,
  RecentOrdersTable,
  SalesOverview,
  TopProductsTable,
} from "@/components/admin/report-sections";
import { secondaryButtonClass } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth";
import { formatDecimalPaisa } from "@/lib/checkout";
import { loadReports } from "@/lib/report-data";
import { parseReportDays, reportsHref, REPORT_DAYS } from "@/lib/reports";

export const metadata: Metadata = {
  title: "Reports · EveryNest Admin",
};

export const instant = false;

interface AdminReportsPageProps {
  searchParams: Promise<{ days?: string }>;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/reports");

  const params = await searchParams;
  const days = parseReportDays(params.days);
  const report = await loadReports(days);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Business reports
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Real figures from orders and stock · days counted in {report.timezone}.
          </p>
        </div>
        <Link href="/admin" className={secondaryButtonClass}>
          Back to dashboard
        </Link>
      </header>

      <nav aria-label="Reporting period" className="mt-6 flex flex-wrap gap-2">
        {REPORT_DAYS.map((value) => (
          <Link
            key={value}
            href={reportsHref(value)}
            aria-current={days === value ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              days === value
                ? "bg-[color:var(--brand)] text-white"
                : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            Last {value} days
          </Link>
        ))}
      </nav>

      <section aria-label="Key figures" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total sales"
          value={formatDecimalPaisa(report.totalSalesPaisa)}
          hint="Confirmed, shipped and delivered orders"
        />
        <StatCard
          label="Total orders"
          value={String(report.statusCounts.all)}
          hint={`${report.statusCounts.pending} pending · ${report.statusCounts.cancelled} cancelled`}
        />
        <StatCard
          label="Live orders"
          value={String(report.statusCounts.confirmed + report.statusCounts.shipped + report.statusCounts.delivered)}
          hint={`${report.statusCounts.delivered} delivered`}
        />
        <StatCard
          label="Low-stock variants"
          value={String(report.lowStockCount)}
          hint={`${report.activeVariants} active variants in catalogue`}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SalesOverview days={report.dailySales} timezone={report.timezone} />
        <TopProductsTable products={report.topProducts} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <LowStockTable items={report.lowStock} />
        <RecentOrdersTable orders={report.recentOrders} />
      </div>

      <p className="mt-6 text-xs text-neutral-500">
        Report generated {new Date(report.generatedAt).toLocaleString("en-PK", { timeZone: report.timezone })} ·
        {" "}all amounts in Pakistani Rupees.
      </p>
    </div>
  );
}
