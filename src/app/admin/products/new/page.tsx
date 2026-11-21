import type { Metadata } from "next";
import { connection } from "next/server";

import { requireStaff } from "@/lib/auth";
import { categorySchemaMap, loadCategoryTree } from "@/lib/category-data";

import { ProductForm } from "../product-form";

export const metadata: Metadata = {
  title: "New product · EveryNest",
};

export const instant = false;

export default async function NewProductPage() {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requireStaff("/admin/products/new");

  const categories = await loadCategoryTree();
  const active = categories.filter((category) => category.is_active);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">New product</h1>
        <p className="mt-1.5 text-sm text-neutral-600">
          Choose a category first; its attributes appear automatically in the variant rows.
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <ProductForm
          mode="create"
          categories={active.map((category) => ({ id: category.id, name: category.name }))}
          categorySchemas={categorySchemaMap(categories)}
          lockedCategory={false}
          initial={{
            name: "",
            slug: "",
            categoryId: active[0]?.id ?? "",
            brand: "",
            description: "",
            isFeatured: false,
            isActive: true,
          }}
          initialVariants={[]}
        />
      </section>
    </div>
  );
}
