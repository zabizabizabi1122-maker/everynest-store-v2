import { createClient } from "@/lib/supabase/server";
import {
  descendantIds,
  effectiveAttributes,
  type CategoryAttribute,
  type CategoryOption,
} from "@/lib/category-schema";

/**
 * Server-only catalogue lookups shared by Level 4 pages and actions.
 * RLS still decides which rows are returned; a customer calling an admin action
 * is stopped by `requireStaff()` before any of these helpers run.
 */

export async function loadCategoryTree(): Promise<CategoryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, is_active, attribute_schema")
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data;
}

/** Effective (inherited) attribute schema for each active category. */
export function categorySchemaMap(
  categories: readonly CategoryOption[],
): Record<string, CategoryAttribute[]> {
  const map: Record<string, CategoryAttribute[]> = {};

  for (const category of categories) {
    if (category.is_active) {
      map[category.id] = effectiveAttributes(categories, category.id).attributes;
    }
  }

  return map;
}

/** True when any variant in the category (or one of its descendants) exists. */
export async function categoryHasVariants(
  categories: readonly CategoryOption[],
  categoryId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const subtreeIds = [categoryId, ...descendantIds(categories, categoryId)];

  const { data: products } = await supabase
    .from("products")
    .select("id")
    .in("category_id", subtreeIds);

  const productIds = (products ?? []).map((product) => product.id);

  if (productIds.length === 0) return false;

  const { count, error } = await supabase
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .in("product_id", productIds);

  return !error && (count ?? 0) > 0;
}
