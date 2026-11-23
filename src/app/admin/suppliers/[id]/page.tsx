import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { STOCK_REASON_LABELS, type StockReason } from "@/lib/inventory";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

import { SupplierForm } from "../supplier-form";

export const metadata: Metadata = {
  title: "Edit supplier · EveryNest",
};

export const instant = false;

interface EditSupplierPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function EditSupplierPage({ params, searchParams }: EditSupplierPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("suppliers.view", "/admin/suppliers");

  const { id } = await params;
  const { saved } = await searchParams;

  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, name, phone, address, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!supplier) notFound();

  const { data: movements } = await supabase
    .from("stock_movements")
    .select("id, change, reason, note, created_at, variant_id")
    .eq("supplier_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const variantIds = [...new Set((movements ?? []).map((movement) => movement.variant_id))];
  const { data: variants } = variantIds.length > 0
    ? await supabase.from("product_variants").select("id, sku").in("id", variantIds)
    : { data: [] };
  const skus = new Map((variants ?? []).map((variant) => [variant.id, variant.sku]));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Warehouse
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit supplier</h1>
        <p className="mt-1.5 text-sm text-neutral-600">{supplier.name}</p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <SupplierForm
          mode="edit"
          supplierId={id}
          initial={{
            name: supplier.name,
            phone: supplier.phone ?? "",
            address: supplier.address ?? "",
            isActive: supplier.is_active,
          }}
          saved={saved === "created"}
        />
      </section>

      <section aria-labelledby="supplier-movements-heading" className="mt-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 p-5">
          <h2 id="supplier-movements-heading" className="text-base font-semibold text-neutral-900">
            Stock movements from this supplier
          </h2>
          <p className="mt-1 text-sm text-neutral-600">Most recent 20 purchase and return entries.</p>
        </div>

        {!movements || movements.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-neutral-500">No linked stock movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">When</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Variant</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Change</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Reason</th>
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
                      {skus.get(movement.variant_id) ?? "—"}
                    </td>
                    <td className={`px-5 py-4 font-semibold ${movement.change > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {movement.change > 0 ? "+" : ""}{movement.change}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {STOCK_REASON_LABELS[movement.reason as StockReason] ?? movement.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
