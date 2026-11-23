import { effectiveAttributes, type CategoryAttribute } from "@/lib/category-schema";
import { isSupabaseConfigured } from "@/lib/env";
import {
  EMPTY_CRITERIA,
  NEW_ARRIVAL_DAYS,
  hasActiveCriteria,
  type ProductFilterCriteria,
} from "@/lib/filters";
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
  /** Sole active variant of a single-variant product, used for card quick-add. */
  defaultVariantId: string | null;
  /** Union of active variant attribute values, keyed by source key. */
  attributeValues: Record<string, string[]>;
  /** Average of approved reviews; null when there are none. */
  rating: number | null;
  isFeatured: boolean;
  isNew: boolean;
  hasDiscount: boolean;
}

export interface ProductListingQuery {
  q: string;
  categoryId: string;
  /** Repeated category links are OR-ed; takes precedence over `categoryId`. */
  categoryIds?: string[];
  minPaisa: number | null;
  maxPaisa: number | null;
  inStockOnly: boolean;
  sort: SortOption;
  page: number;
  /** Additional database-driven filters from `filter_definitions`. */
  filters?: ProductFilterCriteria;
}

export interface CatalogFacets {
  brands: string[];
  attributeValues: Record<string, string[]>;
  /** Effective price bounds in rupees, used only as UI slider limits. */
  priceMinRupees: number;
  priceMaxRupees: number;
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
/** Bounded product/review scans for the advanced filter path. */
const MAX_PRODUCT_SCAN = 2000;
const MAX_REVIEW_SCAN = 5000;

const EMPTY_FACETS: CatalogFacets = {
  brands: [],
  attributeValues: {},
  priceMinRupees: 0,
  priceMaxRupees: 100000,
};

function emptyListing(page: number): ProductListingResult {
  return { products: [], total: 0, page, pageCount: 1 };
}

function isNewArrival(createdAt: string): boolean {
  const created = Date.parse(createdAt);
  return (
    Number.isFinite(created) && created >= Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000
  );
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
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
  products: readonly Pick<
    ProductRow,
    "id" | "name" | "slug" | "brand" | "category_id" | "created_at" | "is_featured"
  >[],
  variants: readonly Pick<
    VariantRow,
    "id" | "product_id" | "price_paisa" | "sale_price_paisa" | "stock" | "attributes"
  >[],
  images: readonly Pick<ImageRow, "product_id" | "url" | "alt_text">[],
  ratings: ReadonlyMap<string, number> = new Map<string, number>(),
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
    const attributeSets = new Map<string, Set<string>>();
    for (const variant of ownVariants) {
      for (const [key, value] of Object.entries(attributesToRecord(variant.attributes))) {
        if (!value) continue;
        const set = attributeSets.get(key) ?? new Set<string>();
        set.add(value);
        attributeSets.set(key, set);
      }
    }
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
      defaultVariantId: ownVariants[0]?.id ?? null,
      attributeValues: Object.fromEntries(
        [...attributeSets].map(([key, values]) => [key, [...values].sort()]),
      ),
      rating: ratings.get(product.id) ?? null,
      isFeatured: product.is_featured,
      isNew: isNewArrival(product.created_at),
      hasDiscount: ownVariants.some(
        (variant) =>
          variant.sale_price_paisa !== null && variant.sale_price_paisa < variant.price_paisa,
      ),
    };
  });
}

type CardSource = Pick<
  ProductRow,
  "id" | "name" | "slug" | "brand" | "category_id" | "created_at" | "is_featured"
>;

/** Average rating per product from approved reviews, bounded by a single scan. */
async function loadRatings(
  supabase: SupabaseClient,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("reviews")
    .select("product_id, rating")
    .eq("status", "approved")
    .limit(MAX_REVIEW_SCAN);

  const totals = new Map<string, { sum: number; count: number }>();
  for (const review of data ?? []) {
    const total = totals.get(review.product_id) ?? { sum: 0, count: 0 };
    totals.set(review.product_id, { sum: total.sum + review.rating, count: total.count + 1 });
  }

  return new Map(
    [...totals].map(([productId, total]) => [productId, total.sum / total.count]),
  );
}

/** Loads the page-size slice of products plus the rows needed to render their cards. */
async function hydrateProducts(
  supabase: SupabaseClient,
  products: readonly CardSource[],
): Promise<CatalogProduct[]> {
  if (products.length === 0) return [];
  const ids = products.map((product) => product.id);

  const [variantsResult, imagesResult, ratings] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, product_id, price_paisa, sale_price_paisa, stock, attributes")
      .in("product_id", ids)
      .eq("is_active", true),
    supabase
      .from("product_images")
      .select("product_id, url, alt_text")
      .in("product_id", ids)
      .order("sort_order", { ascending: true }),
    loadRatings(supabase),
  ]);

  return toCatalogProducts(products, variantsResult.data ?? [], imagesResult.data ?? [], ratings);
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
    .select("id, name, slug, brand, category_id, created_at, is_featured")
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
    .select("id, name, slug, brand, category_id, created_at, is_featured")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(1, limit), PAGE_SIZE * 2));

  return hydrateProducts(supabase, data ?? []);
}

/**
 * Distinct facet values from real catalogue rows. Used only to fill gaps where
 * an admin has not created `filter_options`; nothing here is hardcoded.
 */
export async function loadCatalogFacets(): Promise<CatalogFacets> {
  if (!isSupabaseConfigured()) return EMPTY_FACETS;

  const supabase = await createClient();
  const [productsResult, variantsResult] = await Promise.all([
    supabase.from("products").select("brand").eq("is_active", true).limit(MAX_PRODUCT_SCAN),
    supabase
      .from("product_variants")
      .select("attributes, price_paisa, sale_price_paisa")
      .eq("is_active", true)
      .limit(MAX_VARIANT_SCAN),
  ]);

  const brands = new Map<string, string>();
  for (const product of productsResult.data ?? []) {
    const brand = product.brand?.trim();
    if (brand && !brands.has(normalized(brand))) brands.set(normalized(brand), brand);
  }

  const attributes = new Map<string, Map<string, string>>();
  let minPrice = Number.MAX_SAFE_INTEGER;
  let maxPrice = 0;
  for (const variant of variantsResult.data ?? []) {
    for (const [key, value] of Object.entries(attributesToRecord(variant.attributes))) {
      if (!value) continue;
      const values = attributes.get(key) ?? new Map<string, string>();
      values.set(normalized(value), value);
      attributes.set(key, values);
    }
    try {
      const price = displayPricePaisa({
        id: "",
        sku: "",
        attributes: {},
        pricePaisa: variant.price_paisa,
        salePricePaisa: variant.sale_price_paisa,
        stock: 0,
      });
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
    } catch {
      // Invalid stored prices are ignored for slider bounds.
    }
  }

  return {
    brands: [...brands.values()].sort((left, right) => left.localeCompare(right)),
    attributeValues: Object.fromEntries(
      [...attributes].map(([key, values]) => [key, [...values.values()].sort()]),
    ),
    priceMinRupees: minPrice === Number.MAX_SAFE_INTEGER ? 0 : Math.floor(minPrice / 100),
    priceMaxRupees: maxPrice === 0 ? EMPTY_FACETS.priceMaxRupees : Math.ceil(maxPrice / 100),
  };
}

interface ProductFacts {
  stock: number;
  attributes: Map<string, Set<string>>;
  hasDiscount: boolean;
}

/**
 * Paginated product list.
 *
 * Category/text searches and the common sorts use PostgREST `range()`, so the
 * count and page slice are computed on the server. Price sorting and every
 * configured filter need variant/review data, resolved through bounded scans;
 * a future SQL view could replace those scans without changing any caller.
 */
export async function loadProductListing(query: ProductListingQuery): Promise<ProductListingResult> {
  if (!isSupabaseConfigured()) return emptyListing(query.page);

  const supabase = await createClient();
  const search = sanitizeSearch(query.q);
  const priceSort = query.sort === "price-asc" || query.sort === "price-desc";
  const criteria = query.filters ?? EMPTY_CRITERIA;
  const categoryIds = query.categoryIds?.length
    ? query.categoryIds
    : query.categoryId
      ? [query.categoryId]
      : [];
  const hasVariantFilter = query.minPaisa !== null || query.maxPaisa !== null || query.inStockOnly;
  const hasAdvancedFilters = hasActiveCriteria(criteria) || categoryIds.length > 1;
  const needsVariantScan = priceSort || hasVariantFilter || hasAdvancedFilters;
  const byName = query.sort === "name-asc";

  function filteredProducts() {
    let builder = supabase
      .from("products")
      .select("id, name, slug, brand, category_id, created_at, is_featured", { count: "exact" })
      .eq("is_active", true);

    if (search) builder = builder.ilike("name", `%${search}%`);
    if (categoryIds.length === 1) builder = builder.eq("category_id", categoryIds[0]);
    if (categoryIds.length > 1) builder = builder.in("category_id", categoryIds);

    return builder;
  }

  // ---- Filter-aware path: price sorting and all configured filters ----------
  if (needsVariantScan) {
    const { data: scannedVariants } = await supabase
      .from("product_variants")
      .select("id, product_id, attributes, price_paisa, sale_price_paisa, stock, is_active")
      .eq("is_active", true)
      .limit(MAX_VARIANT_SCAN);

    const variants = scannedVariants ?? [];
    const matchingIds = new Set(
      filterProductsByVariantCriteria(variants, {
        minPaisa: query.minPaisa,
        maxPaisa: query.maxPaisa,
        inStockOnly: query.inStockOnly,
      }),
    );

    if (hasVariantFilter && matchingIds.size === 0) return emptyListing(query.page);

    const minPrices = new Map<string, number>();
    const factsByProduct = new Map<string, ProductFacts>();
    for (const variant of variants) {
      const facts = factsByProduct.get(variant.product_id) ?? {
        stock: 0,
        attributes: new Map<string, Set<string>>(),
        hasDiscount: false,
      };
      facts.stock += variant.stock;
      if (variant.sale_price_paisa !== null && variant.sale_price_paisa < variant.price_paisa) {
        facts.hasDiscount = true;
      }
      for (const [key, value] of Object.entries(attributesToRecord(variant.attributes))) {
        if (!value) continue;
        const values = facts.attributes.get(key) ?? new Set<string>();
        values.add(normalized(value));
        facts.attributes.set(key, values);
      }
      factsByProduct.set(variant.product_id, facts);

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
    ).limit(MAX_PRODUCT_SCAN);

    const ratings = hasAdvancedFilters
      ? await loadRatings(supabase)
      : new Map<string, number>();

    const matchesCriteria = (product: CardSource): boolean => {
      const facts = factsByProduct.get(product.id);
      if (!facts) return false;
      if (hasVariantFilter && !matchingIds.has(product.id)) return false;
      if (criteria.inStockOnly && facts.stock <= 0) return false;
      if (
        criteria.brands.length > 0 &&
        !criteria.brands.some((brand) => normalized(product.brand ?? "") === normalized(brand))
      ) {
        return false;
      }
      for (const [key, values] of Object.entries(criteria.attributes)) {
        const available = facts.attributes.get(key);
        if (!available || !values.some((value) => available.has(normalized(value)))) return false;
      }
      if (criteria.minRating !== null) {
        const rating = ratings.get(product.id);
        if (rating === undefined || rating < criteria.minRating) return false;
      }
      if (criteria.hasDiscount && !facts.hasDiscount) return false;
      if (criteria.isFeatured && !product.is_featured) return false;
      if (criteria.isNewArrival && !isNewArrival(product.created_at)) return false;
      return true;
    };

    const possibleProducts = (possible ?? []).filter(matchesCriteria);
    const byId = new Map(possibleProducts.map((product) => [product.id, product]));
    const ids = possibleProducts.map((product) => product.id);

    if (priceSort) {
      ids.sort((left, right) => (minPrices.get(left) ?? 0) - (minPrices.get(right) ?? 0));
      if (query.sort === "price-desc") ids.reverse();
    } else if (byName) {
      ids.sort((left, right) =>
        (byId.get(left)?.name ?? "").localeCompare(byId.get(right)?.name ?? ""),
      );
    } else {
      ids.sort(
        (left, right) =>
          Date.parse(byId.get(right)?.created_at ?? "") - Date.parse(byId.get(left)?.created_at ?? ""),
      );
    }

    const total = ids.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = (query.page - 1) * PAGE_SIZE;
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
      .select("id, name, slug, brand, category_id, created_at, is_featured")
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
