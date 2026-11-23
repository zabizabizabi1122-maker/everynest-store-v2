import type { Metadata } from "next";
import { connection } from "next/server";

import { requirePermission } from "@/lib/auth";

import { SupplierForm } from "../supplier-form";

export const metadata: Metadata = {
  title: "New supplier · EveryNest",
};

export const instant = false;

export default async function NewSupplierPage() {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("suppliers.view", "/admin/suppliers/new");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Warehouse
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">New supplier</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Add a supplier so purchase movements can be linked to a source.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <SupplierForm
          mode="create"
          initial={{ name: "", phone: "", address: "", isActive: true }}
        />
      </section>
    </div>
  );
}
