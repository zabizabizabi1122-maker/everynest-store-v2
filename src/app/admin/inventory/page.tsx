import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import type { ReactNode } from "react";

import { secondaryButtonClass } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth";
import {
  isLowStock,
  STOCK_REASON_LABELS,
  stockLabel,
  type StockReason,
} from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";

import { AdjustStockForm } from "./adjust-stock-form";

export const metadata: Metadata = {
  title: "Inventory · EveryNest",
};

export const instant = false;

interface InventoryPageProps {
  searchParams: Promise<{ page?: string }>;
}

const MOVEMENT_PAGE_SIZE = 20;

function statCard(label: string, value: string, tone: string): ReactNode {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/inventory");

  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const supabase = await createClient();

  const [variantsResult, productsResult, suppliersResult] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, product_id, sku, stock, reorder_level, is_active")
      .order("sku", { ascending: true }),
    supabase.from("products").select("id, name"),
    supabase.from("suppliers").select("id, name, is_active").order("name", { ascending: true }),
  ]);

  const variants = variantsResult.data ?? [];
  const productNames = new Map((productsResult.data ?? []).map((product) => [product.id, product.name]));
  const suppliers = suppliersResult.data ?? [];
  const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  const totalUnits = variants.reduce((sum, variant) => sum + variant.stock, 0);
  const lowStock = variants
    .filter((variant) => variant.is_active && isLowStock(variant.stock, variant.reorder_level))
    .sort((a, b) => a.stock - b.stock || a.sku.localeCompare(b.sku));
  const outOfStock = lowStock.filter((variant) => variant.stock === 0).length;

  const activeVariants = variants.filter((variant) => variant.is_active);
  const variantOptions = activeVariants.map((variant) => ({
    id: variant.id,
    label: `${productNames.get(variant.product_id) ?? "Product"} — ${variant.sku}`,
  }));
  const supplierOptions = suppliers
    .filter((supplier) => supplier.is_active)
    .map((supplier) => ({ id: supplier.id, name: supplier.name }));

  const from = (page - 1) * MOVEMENT_PAGE_SIZE;
  const { data: movements, count: movementCount } = await supabase
    .from("stock_movements")
    .select("id, change, reason, note, created_at, variant_id, supplier_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + MOVEMENT_PAGE_SIZE - 1);

  const totalMovements = movementCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalMovements / MOVEMENT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  function movementPageHref(target: number): string {
    return `/admin/inventory?page=${target}`;
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
            Warehouse
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1.5 text-sm text-neutral-600">
            Review stock levels, record movements through the trusted RPC, and check low-stock items.
          </p>
        </div>
        <Link href="/admin/suppliers" className={secondaryButtonClass}>
          Suppliers
        </Link>
      </header>

      {variantsResult.error || productsResult.error || suppliersResult.error ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Some inventory data could not be loaded. Check the Supabase connection and try again.
        </p>
      ) : null}

      <section aria-label="Stock summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCard("Active variants", String(activeVariants.length), "text-neutral-900")}
        {statCard("Units in stock", String(totalUnits), "text-neutral-900")}
        {statCard("Low stock", String(lowStock.length), lowStock.length > 0 ? "text-amber-600" : "text-neutral-900")}
        {statCard("Out of stock", String(outOfStock), outOfStock > 0 ? "text-red-600" : "text-neutral-900")}
      </section>

      <section aria-labelledby="low-stock-heading" className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 p-5">
          <h2 id="low-stock-heading" className="text-base font-semibold text-neutral-900">
            Low-stock items
          </h2>
          <p className="mt-1 text-sm text-neutral-600">Variants at or below their reorder level.</p>
        </div>

        {lowStock.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-neutral-500">Nothing needs restocking right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Variant</th>
                  <th scope="col" className="px-5 py-3 font-semibold">In stock</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Reorder at</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Product</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lowStock.slice(0, 20).map((variant) => (
                  <tr key={variant.id} className="transition hover:bg-neutral-50/80">
                    <td className="px-5 py-4 font-mono text-xs text-neutral-800">{variant.sku}</td>
                    <td className="px-5 py-4 font-semibold text-neutral-900">{variant.stock}</td>
                    <td className="px-5 py-4 text-neutral-600">{variant.reorder_level}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          variant.stock === 0
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {stockLabel(variant.stock, variant.reorder_level)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-neutral-600">
                      <Link
                        href={`/admin/products/${variant.product_id}`}
                        className="font-medium text-[color:var(--brand)] hover:underline"
                      >
                        {productNames.get(variant.product_id) ?? "View product"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lowStock.length > 20 ? (
          <p className="border-t border-neutral-200 px-5 py-3 text-xs text-neutral-500">
            Showing the 20 lowest variants of {lowStock.length} that need attention.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="adjust-heading" className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 id="adjust-heading" className="sr-only">Adjust stock</h2>
        <AdjustStockForm variants={variantOptions} suppliers={supplierOptions} />
      </section>

      <section aria-labelledby="movements-heading" className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 p-5">
          <h2 id="movements-heading" className="text-base font-semibold text-neutral-900">
            Stock movement history
          </h2>
          <p className="mt-1 text-sm text-neutral-600">Append-only ledger written by trusted database functions.</p>
        </div>

        {!movements || movements.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-neutral-500">No stock movements recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">When</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Variant</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Change</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Reason</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Supplier</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {movements.map((movement) => (
                  <tr key={movement.id} className="transition hover:bg-neutral-50/80">
                    <td className="whitespace-nowrap px-5 py-4 text-neutral-600">
                      {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(
                        new Date(movement.created_at),
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-neutral-800">
                      {variants.find((variant) => variant.id === movement.variant_id)?.sku ?? "—"}
                    </td>
                    <td className={`px-5 py-4 font-semibold ${movement.change > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {movement.change > 0 ? "+" : ""}{movement.change}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {STOCK_REASON_LABELS[movement.reason as StockReason] ?? movement.reason}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {movement.supplier_id ? (supplierNames.get(movement.supplier_id) ?? "—") : "—"}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{movement.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalMovements > MOVEMENT_PAGE_SIZE ? (
          <nav aria-label="Movement pagination" className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 text-sm">
            <span className="text-neutral-600">Page {currentPage} of {pageCount}</span>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link href={movementPageHref(currentPage - 1)} className={secondaryButtonClass}>Previous</Link>
              ) : null}
              {currentPage < pageCount ? (
                <Link href={movementPageHref(currentPage + 1)} className={secondaryButtonClass}>Next</Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
