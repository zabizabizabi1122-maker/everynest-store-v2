import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

/**
 * Server-only catalogue lookups shared by Level 5 pages and actions.
 * RLS still narrows rows to what the signed-in role may see; every caller here
 * has already passed `requireStaff()`.
 */

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
export type ProductImageRow = Database["public"]["Tables"]["product_images"]["Row"];

export interface ProductDetail {
  product: ProductRow | null;
  variants: VariantRow[];
  images: ProductImageRow[];
}

/** Loads one product together with every variant and gallery image. */
export async function loadProductDetail(id: string): Promise<ProductDetail> {
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) {
    return { product: null, variants: [], images: [] };
  }

  const [variantsResult, imagesResult] = await Promise.all([
    supabase.from("product_variants").select("*").eq("product_id", id).order("sku", { ascending: true }),
    supabase.from("product_images").select("*").eq("product_id", id).order("sort_order", { ascending: true }),
  ]);

  return {
    product,
    variants: variantsResult.data ?? [],
    images: imagesResult.data ?? [],
  };
}

/**
 * SKUs are globally unique, so check them before inserting a product: if an
 * insert of the product succeeded but a variant failed, the app role has no
 * DELETE grant on products and could not roll the half-created product back.
 */
export async function conflictingSkus(skus: readonly string[]): Promise<string[]> {
  if (skus.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("sku")
    .in("sku", [...skus]);

  if (error || !data) return [];
  return data.map((variant) => variant.sku);
}
