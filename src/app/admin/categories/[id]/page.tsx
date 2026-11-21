import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { requireStaff } from "@/lib/auth";
import { categoryHasVariants, loadCategoryTree } from "@/lib/category-data";
import {
  descendantIds,
  effectiveAttributes,
  fromSchemaJson,
  inheritedAttributes,
} from "@/lib/category-schema";
import { uuidSchema } from "@/lib/validators";

import { CategoryForm } from "../category-form";

export const metadata: Metadata = {
  title: "Edit category · EveryNest",
};

export const instant = false;

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}

export default async function EditCategoryPage({ params, searchParams }: EditCategoryPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/categories");

  const { id } = await params;
  const { saved } = await searchParams;

  if (!uuidSchema.safeParse(id).success) notFound();

  const categories = await loadCategoryTree();
  const category = categories.find((item) => item.id === id);

  if (!category) notFound();

  const excluded = new Set([id, ...descendantIds(categories, id)]);
  const parents = categories
    .filter((item) => item.is_active && !excluded.has(item.id))
    .map((item) => ({ id: item.id, name: item.name }));

  const [hasVariants, inherited, effective] = await Promise.all([
    categoryHasVariants(categories, id),
    Promise.resolve(inheritedAttributes(categories, category.parent_id)),
    Promise.resolve(effectiveAttributes(categories, id)),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit category</h1>
        <p className="mt-1.5 text-sm text-neutral-600">{category.name}</p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <CategoryForm
          mode="edit"
          categoryId={id}
          parents={parents}
          initial={{
            name: category.name,
            slug: category.slug,
            parentId: category.parent_id ?? "",
            isActive: category.is_active,
            attributes: fromSchemaJson(category.attribute_schema),
          }}
          inherited={inherited}
          effective={effective.attributes}
          hasVariants={hasVariants}
          saved={saved === "created"}
        />
      </section>
    </div>
  );
}
