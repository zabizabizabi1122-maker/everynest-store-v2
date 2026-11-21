import type { Metadata } from "next";
import { connection } from "next/server";

import { requireStaff } from "@/lib/auth";
import { loadCategoryTree } from "@/lib/category-data";

import { CategoryForm } from "../category-form";

export const metadata: Metadata = {
  title: "New category · EveryNest",
};

export const instant = false;

export default async function NewCategoryPage() {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/categories/new");

  const categories = await loadCategoryTree();
  const parents = categories
    .filter((category) => category.is_active)
    .map((category) => ({ id: category.id, name: category.name }));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">New category</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Add a top-level category or place it under an existing one.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <CategoryForm
          mode="create"
          parents={parents}
          initial={{ name: "", slug: "", parentId: "", isActive: true, attributes: [] }}
          inherited={[]}
          effective={[]}
          hasVariants={false}
        />
      </section>
    </div>
  );
}
