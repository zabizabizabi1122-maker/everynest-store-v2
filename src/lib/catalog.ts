import { effectiveAttributes, type CategoryAttribute } from "@/lib/category-schema";
import { isSupabaseConfigured } from "@/lib/env";
import { displayPricePaisa, type SelectorVariant } from "@/lib/storefront";
import {
  filterProductsByVariantCriteria,
  PAGE_SIZE,
  sanitizeSearch,
  type SortOption,
} from "@/lib/storefront";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";

/**
 * Level 7 — read-only catalogue access for the public storefront.
 *
 * All queries run as the anonymous/published key, so the Level 1 RLS policies
 * are the real security boundary: inactive products, variants, categories and
 * their images are never returned to a visitor. Explicit `is_active` filters
 * are still applied here as defence in depth and for readable query intent.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type VariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
type ImageRow = Database["public"]["Tables"]["product_images"]["Row"];

export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  categoryId: string;
  createdAt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  minPricePaisa: number | null;
  /** Lowest regular price, present only when a variant is discounted. Display-only derivation. */
  compareAtPaisa: number | null;
  stock: number;
  variantCount: number;
}

export interface ProductListingQuery {
  q: string;
  categoryId: string;
  minPaisa: number | null;
  maxPaisa: number | null;
  inStockOnly: boolean;
  sort: SortOption;
  page: number;
}

export interface ProductListingResult {
  products: CatalogProduct[];
  total: number;
  page: number;
  pageCount: number;
}

export interface CatalogProductDetail {
  product: ProductRow;
  category: { id: string; name: string; slug: string } | null;
  schema: CategoryAttribute[];
  images: ImageRow[];
  variants: SelectorVariant[];
  related: CatalogProduct[];
}

export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

/** Bounds the price/availability pre-scan so no filter loads an unbounded table. */
const MAX_VARIANT_SCAN = 2000;
/** Caps the id list passed to PostgREST; keeps generated URLs within safe limits. */
const MAX_FILTERED_IDS = 200;

function emptyListing(page: number): ProductListingResult {
  return { products: [], total: 0, page, pageCount: 1 };
}

function toSelectorVariant(variant: VariantRow): SelectorVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    attributes: attributesToRecord(variant.attributes),
    pricePaisa: variant.price_paisa,
    salePricePaisa: variant.sale_price_paisa,
    stock: variant.stock,
  };
}

export function attributesToRecord(value: Json): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

/** Builds card-ready rows from a page of products and their related rows. */
function toCatalogProducts(
  products: readonly Pick<ProductRow, "id" | "name" | "slug" | "brand" | "category_id" | "created_at">[],
  variants: readonly Pick<VariantRow, "product_id" | "price_paisa" | "sale_price_paisa" | "stock">[],
  images: readonly Pick<ImageRow, "product_id" | "url" | "alt_text">[],
): CatalogProduct[] {
  return products.map((product) => {
    const ownVariants = variants.filter((variant) => variant.product_id === product.id);
    const prices = ownVariants.map((variant) =>
      displayPricePaisa({
        id: "",
        sku: "",
        attributes: {},
        pricePaisa: variant.price_paisa,
        salePricePaisa: variant.sale_price_paisa,
        stock: variant.stock,
      }),
    );
    const firstImage = images.find((image) => image.product_id === product.id);
    const effectiveMin = prices.length > 0 ? Math.min(...prices) : null;
    const regularMin =
      ownVariants.length > 0 ? Math.min(...ownVariants.map((variant) => variant.price_paisa)) : null;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      categoryId: product.category_id,
      createdAt: product.created_at,
      imageUrl: firstImage?.url ?? null,
      imageAlt: firstImage?.alt_text ?? null,
      minPricePaisa: effectiveMin,
      compareAtPaisa:
        regularMin !== null && effectiveMin !== null && regularMin > effectiveMin ? regularMin : null,
      stock: ownVariants.reduce((sum, variant) => sum + variant.stock, 0),
      variantCount: ownVariants.length,
    };
  });
}

type CardSource = Pick<ProductRow, "id" | "name" | "slug" | "brand" | "category_id" | "created_at">;

/** Loads the page-size slice of products plus the rows needed to render their cards. */
async function hydrateProducts(
  supabase: SupabaseClient,
  products: readonly CardSource[],
): Promise<CatalogProduct[]> {
  if (products.length === 0) return [];
  const ids = products.map((product) => product.id);

  const [variantsResult, imagesResult] = await Promise.all([
    supabase
      .from("product_variants")
      .select("product_id, price_paisa, sale_price_paisa, stock")
      .in("product_id", ids)
      .eq("is_active", true),
    supabase
      .from("product_images")
      .select("product_id, url, alt_text")
      .in("product_id", ids)
      .order("sort_order", { ascending: true }),
  ]);

  return toCatalogProducts(products, variantsResult.data ?? [], imagesResult.data ?? []);
}

/** Active categories for the storefront navigation and homepage tiles. */
export async function loadPublicCategories(): Promise<CatalogCategory[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("is_active", true)
    .order("name", { ascending: true });

  return (data ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parent_id,
  }));
}

/** Active products for the homepage sections. */
export async function loadFeaturedProducts(limit = 8): Promise<CatalogProduct[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, name, slug, brand, category_id, created_at")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), PAGE_SIZE * 2));

  return hydrateProducts(supabase, data ?? []);
}

export async function loadLatestProducts(limit = 8): Promise<CatalogProduct[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, name, slug, brand, category_id, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), PAGE_SIZE * 2));

  return hydrateProducts(supabase, data ?? []);
}

/**
 * Paginated product list.
 *
 * Category/text searches and the common sorts use PostgREST `range()`, so the
 * count and page slice are computed on the server. Price sorting and price/
 * availability filters need variant-level data, which is resolved through a
 * bounded active-variant scan; a future SQL view could replace that scan
 * without changing any caller (see docs/DECISIONS.md, Level 7).
 */
export async function loadProductListing(query: ProductListingQuery): Promise<ProductListingResult> {
  if (!isSupabaseConfigured()) return emptyListing(query.page);

  const supabase = await createClient();
  const search = sanitizeSearch(query.q);
  const priceSort = query.sort === "price-asc" || query.sort === "price-desc";
  const hasVariantFilter = query.minPaisa !== null || query.maxPaisa !== null || query.inStockOnly;
  const needsVariantScan = priceSort || hasVariantFilter;
  const byName = query.sort === "name-asc";

  function filteredProducts() {
    let builder = supabase
      .from("products")
      .select("id, name, slug, brand, category_id, created_at")
      .eq("is_active", true);

    if (search) builder = builder.ilike("name", `%${search}%`);
    if (query.categoryId) builder = builder.eq("category_id", query.categoryId);

    return builder;
  }

  // ---- Variant-aware path: price sorting and/or price/stock filters --------
  if (needsVariantScan) {
    const { data: scannedVariants } = await supabase
      .from("product_variants")
      .select("product_id, price_paisa, sale_price_paisa, stock, is_active")
      .eq("is_active", true)
      .limit(MAX_VARIANT_SCAN);

    const matchingIds = new Set(
      filterProductsByVariantCriteria(scannedVariants ?? [], {
        minPaisa: query.minPaisa,
        maxPaisa: query.maxPaisa,
        inStockOnly: query.inStockOnly,
      }),
    );

    if (hasVariantFilter && matchingIds.size === 0) return emptyListing(query.page);

    const minPrices = new Map<string, number>();
    for (const variant of scannedVariants ?? []) {
      try {
        const price = displayPricePaisa({
          id: "",
          sku: "",
          attributes: {},
          pricePaisa: variant.price_paisa,
          salePricePaisa: variant.sale_price_paisa,
          stock: variant.stock,
        });
        minPrices.set(variant.product_id, Math.min(minPrices.get(variant.product_id) ?? Number.MAX_SAFE_INTEGER, price));
      } catch {
        // An invalid stored price is skipped rather than breaking the listing.
      }
    }

    const possibleQuery = filteredProducts();
    const { data: possible } = await (byName
      ? possibleQuery.order("name", { ascending: true })
      : possibleQuery.order("created_at", { ascending: false })
    ).limit(MAX_FILTERED_IDS);

    const possibleProducts = (possible ?? [])
      .filter((product) => !hasVariantFilter || matchingIds.has(product.id))
      .slice(0, MAX_FILTERED_IDS);

    let ids = possibleProducts.map((product) => product.id);

    if (priceSort) {
      ids = ids.sort((left, right) => (minPrices.get(left) ?? 0) - (minPrices.get(right) ?? 0));
      if (query.sort === "price-desc") ids.reverse();
    }

    const total = ids.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = (query.page - 1) * PAGE_SIZE;
    const byId = new Map(possibleProducts.map((product) => [product.id, product]));
    const pageRows = ids.slice(from, from + PAGE_SIZE).flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });

    return {
      products: await hydrateProducts(supabase, pageRows),
      total,
      page: query.page,
      pageCount,
    };
  }

  // ---- Default path: true SQL pagination -----------------------------------
  const from = (query.page - 1) * PAGE_SIZE;
  const cardQuery = filteredProducts();
  const { data, count, error } = await (byName
    ? cardQuery.order("name", { ascending: true })
    : cardQuery.order("created_at", { ascending: false })
  ).range(from, from + PAGE_SIZE - 1);

  if (error) return emptyListing(query.page);

  const total = count ?? 0;
  return {
    products: await hydrateProducts(supabase, data ?? []),
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Single product by public slug, with its effective schema and related items. */
export async function loadProductBySlug(slug: string): Promise<CatalogProductDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, category_id, name, slug, brand, description, is_featured, is_active, created_at, updated_at")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) return null;

  const [variantsResult, imagesResult, categoryResult, relatedResult] = await Promise.all([
    supabase.from("product_variants").select("*").eq("product_id", product.id).eq("is_active", true).order("sku", { ascending: true }),
    supabase.from("product_images").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("categories").select("id, name, slug, parent_id, is_active, attribute_schema").eq("id", product.category_id).maybeSingle(),
    supabase
      .from("products")
      .select("id, name, slug, brand, category_id, created_at")
      .eq("category_id", product.category_id)
      .eq("is_active", true)
      .neq("id", product.id)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const categories = categoryResult.data
    ? [
        {
          id: categoryResult.data.id,
          name: categoryResult.data.name,
          slug: categoryResult.data.slug,
          parent_id: categoryResult.data.parent_id,
          is_active: categoryResult.data.is_active,
          attribute_schema: categoryResult.data.attribute_schema,
        },
      ]
    : [];

  const schemaResult = effectiveAttributes(categories, product.category_id);

  return {
    product,
    category: categoryResult.data
      ? { id: categoryResult.data.id, name: categoryResult.data.name, slug: categoryResult.data.slug }
      : null,
    schema: schemaResult.attributes,
    images: imagesResult.data ?? [],
    variants: (variantsResult.data ?? []).map(toSelectorVariant),
    related: await hydrateProducts(supabase, relatedResult.data ?? []),
  };
}
