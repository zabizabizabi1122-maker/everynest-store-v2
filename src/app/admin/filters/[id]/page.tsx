import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { loadFilterConfig } from "@/lib/filters";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

import { FilterForm } from "../filter-form";

export const metadata: Metadata = {
  title: "Edit filter · EveryNest",
};

export const instant = false;

interface EditFilterPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function EditFilterPage({ params, searchParams }: EditFilterPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("filters.view", "/admin/filters");

  const { id } = await params;
  const { saved } = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [config, categoriesResult] = await Promise.all([
    loadFilterConfig({ includeInactive: true }),
    supabase.from("categories").select("id, name").order("name", { ascending: true }),
  ]);

  const definition = config.definitions.find((item) => item.id === id);
  if (!definition) notFound();

  const options = config.options
    .filter((option) => option.filterId === id)
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((option) => ({
      id: option.id,
      value: option.value,
      label: option.label,
      colorHex: option.colorHex,
      displayOrder: option.displayOrder,
      isActive: option.isActive,
    }));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Website
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit filter</h1>
        <p className="mt-1.5 text-sm text-neutral-600">{definition.label}</p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <FilterForm
          mode="edit"
          filterId={id}
          categories={(categoriesResult.data ?? []).map((category) => ({
            id: category.id,
            name: category.name,
          }))}
          initial={{
            key: definition.key,
            label: definition.label,
            description: definition.description ?? "",
            type: definition.type,
            sourceKey: definition.sourceKey ?? "",
            isActive: definition.isActive,
            isMultiple: definition.isMultiple,
            appliesToAll: definition.appliesToAll,
            displayOrder: definition.displayOrder,
            categoryIds: definition.categoryIds,
            options,
          }}
          saved={saved === "created"}
        />
      </section>
    </div>
  );
}
