import { cache } from "react";

import { getCurrentUser, requireUser } from "@/lib/auth";
import { displayPricePaisa } from "@/lib/storefront";
import { createClient } from "@/lib/supabase/server";
import type { WishlistProduct } from "@/lib/wishlist";

export interface WishlistEntry {
  /** wishlist_items row id, used by the remove form. */
  id: string;
  addedAt: string;
  product: WishlistProduct | null;
}

/**
 * Loads the signed-in customer's wishlist.
 *
 * RLS already limits `wishlist_items` to the caller's own rows; the product
 * lookups are a separate bounded query so the page can show names, an image and
 * a current price without trusting any data from the wishlist row itself.
 */
export const loadWishlist = cache(async (): Promise<WishlistEntry[]> => {
  await requireUser("/wishlist");
  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("wishlist_items")
    .select("id, product_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !items || items.length === 0) return [];

  const ids = [...new Set(items.map((item) => item.product_id))];
  const [productsResult, imagesResult, variantsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, slug, is_active")
      .in("id", ids),
    supabase
      .from("product_images")
      .select("product_id, url")
      .in("product_id", ids)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_variants")
      .select("product_id, price_paisa, sale_price_paisa, stock")
      .in("product_id", ids)
      .eq("is_active", true),
  ]);

  const products = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product]),
  );
  const firstImage = new Map<string, string>();
  for (const image of imagesResult.data ?? []) {
    if (!firstImage.has(image.product_id)) firstImage.set(image.product_id, image.url);
  }

  const prices = new Map<string, number>();
  const stock = new Map<string, number>();
  for (const variant of variantsResult.data ?? []) {
    stock.set(variant.product_id, (stock.get(variant.product_id) ?? 0) + variant.stock);
    const price = displayPricePaisa({
      id: "",
      sku: "",
      attributes: {},
      pricePaisa: variant.price_paisa,
      salePricePaisa: variant.sale_price_paisa,
      stock: variant.stock,
    });
    prices.set(
      variant.product_id,
      Math.min(prices.get(variant.product_id) ?? Number.MAX_SAFE_INTEGER, price),
    );
  }

  return items.map((item) => {
    const product = products.get(item.product_id);
    if (!product) return { id: item.id, addedAt: item.created_at, product: null };

    const display: WishlistProduct = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      imageUrl: firstImage.get(product.id) ?? null,
      minPricePaisa: prices.get(product.id) ?? null,
      inStock: product.is_active && (stock.get(product.id) ?? 0) > 0,
    };
    return { id: item.id, addedAt: item.created_at, product: display };
  });
});

/**
 * Whether one product is on the current customer's wishlist.
 * Returns false for visitors who are not signed in (no redirect).
 */
export async function isWishlisted(productId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("product_id", productId)
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}
