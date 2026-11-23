import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/auth";
import { categorySchemaMap, loadCategoryTree } from "@/lib/category-data";
import { loadProductDetail } from "@/lib/product-data";
import type { Json } from "@/types/database.types";
import { uuidSchema } from "@/lib/validators";

import { ProductForm, type InitialVariant } from "../product-form";
import { ProductImages } from "../product-images";

export const metadata: Metadata = {
  title: "Edit product · EveryNest",
};

export const instant = false;

interface EditProductPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; imageError?: string }>;
}

function attributesToRecord(value: Json): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export default async function EditProductPage({ params, searchParams }: EditProductPageProps) {
  // Supabase's token-expiry check reads Date.now(); mark this page
  // request-bound before that read so Next.js does not prerender it.
  await connection();

  await requirePermission("products.view", "/admin/products");

  const { id } = await params;
  const { saved, imageError } = await searchParams;

  if (!uuidSchema.safeParse(id).success) notFound();

  const [{ product, variants, images }, categories] = await Promise.all([
    loadProductDetail(id),
    loadCategoryTree(),
  ]);

  if (!product) notFound();

  const initialVariants: InitialVariant[] = variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    attributes: attributesToRecord(variant.attributes),
    pricePaisa: variant.price_paisa,
    salePricePaisa: variant.sale_price_paisa,
    reorderLevel: variant.reorder_level,
    isActive: variant.is_active,
    stock: variant.stock,
  }));

  const lockedCategory = variants.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--brand)]">
          Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit product</h1>
        <p className="mt-1.5 text-sm text-neutral-600">{product.name}</p>
      </header>

      <div className="mt-8">
        <ProductForm
          mode="edit"
          productId={id}
          categories={categories
            .filter((category) => category.is_active || category.id === product.category_id)
            .map((category) => ({ id: category.id, name: category.name }))}
          categorySchemas={categorySchemaMap(categories)}
          lockedCategory={lockedCategory}
          initial={{
            name: product.name,
            slug: product.slug,
            categoryId: product.category_id,
            brand: product.brand ?? "",
            description: product.description ?? "",
            isFeatured: product.is_featured,
            isActive: product.is_active,
          }}
          initialVariants={initialVariants}
          saved={saved === "created"}
        />
      </div>

      <div className="mt-8">
        <ProductImages productId={id} images={images} imageError={imageError} />
      </div>
    </div>
  );
}
