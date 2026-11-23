import type { Metadata } from "next";
import { connection } from "next/server";

import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { FilterForm } from "../filter-form";

export const metadata: Metadata = {
  title: "New filter · EveryNest",
};

export const instant = false;

export default async function NewFilterPage() {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("filters.view", "/admin/filters/new");

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("id, name").order("name", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Website
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">New filter</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Define a storefront filter and the options customers can choose.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <FilterForm
          mode="create"
          categories={(data ?? []).map((category) => ({ id: category.id, name: category.name }))}
          initial={{
            key: "",
            label: "",
            description: "",
            type: "attribute",
            sourceKey: "",
            isActive: true,
            isMultiple: true,
            appliesToAll: true,
            displayOrder: 0,
            categoryIds: [],
            options: [],
          }}
        />
      </section>
    </div>
  );
}
