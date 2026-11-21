import type { CategoryAttribute } from "@/lib/category-schema";
import { effectivePricePaisa, rupeesToPaisa } from "@/lib/money";

/**
 * Level 7 — pure storefront rules.
 * Used by both the Server Components (listing filters, availability) and the
 * client-side variant selector, and covered by unit tests. Nothing here talks
 * to the database; RLS remains the authority for what a visitor can read.
 */

export const PAGE_SIZE = 12;
export const MAX_PAGE = 1000;

export const SORT_OPTIONS = ["newest", "price-asc", "price-desc", "name-asc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "name-asc": "Name: A to Z",
};

export function parseSort(value: string | undefined): SortOption {
  return SORT_OPTIONS.find((option) => option === value) ?? "newest";
}

/** Parses a positive integer from a query string, with a safe fallback. */
export function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Parses an optional rupee price filter into paisa. Uses the same canonical
 * converter as the admin editor, so "1500", "1,500" and "1500.50" all work.
 * Blank/invalid values mean "no filter" instead of surfacing an error.
 */
export function parsePaisaFilter(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null;

  try {
    return rupeesToPaisa(value);
  } catch {
    return null;
  }
}

export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), Math.max(1, pageCount));
}

/**
 * Strips PostgREST filter metacharacters from a search box before it is used in
 * an `ilike` pattern. `%`, `_`, commas and parentheses would otherwise change
 * the meaning of the query instead of matching literal text.
 */
export function sanitizeSearch(value: string | undefined): string {
  if (!value) return "";
  return value
    .replace(/[^a-z0-9\s-]/gi, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Variant selector
// ---------------------------------------------------------------------------

export interface SelectorVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  pricePaisa: number;
  salePricePaisa: number | null;
  stock: number;
}

export interface SelectorAttribute {
  key: string;
  label: string;
  options: string[];
}

/**
 * Builds the selector from the effective category schema plus any real variant
 * values. Only options that exist on at least one active variant are offered,
 * so a visitor can never choose a combination that cannot be fulfilled.
 */
export function buildSelectorAttributes(
  schema: readonly CategoryAttribute[],
  variants: readonly SelectorVariant[],
): SelectorAttribute[] {
  const valueSets = new Map<string, Set<string>>();
  const extraKeys: string[] = [];

  for (const variant of variants) {
    for (const [key, value] of Object.entries(variant.attributes)) {
      if (typeof value !== "string" || value.trim() === "") continue;
      const set = valueSets.get(key) ?? new Set<string>();
      set.add(value);
      valueSets.set(key, set);
    }
  }

  const keys = schema.map((attribute) => attribute.key);
  for (const key of valueSets.keys()) {
    if (!keys.includes(key)) extraKeys.push(key);
  }

  const attributes: SelectorAttribute[] = [];

  for (const attribute of schema) {
    const existing = valueSets.get(attribute.key);
    if (!existing || existing.size === 0) continue;

    const ordered = attribute.options.filter((option) => existing.has(option));
    for (const value of [...existing].sort()) {
      if (!ordered.includes(value)) ordered.push(value);
    }

    attributes.push({ key: attribute.key, label: attribute.label, options: ordered });
  }

  for (const key of extraKeys.sort()) {
    attributes.push({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      options: [...(valueSets.get(key) ?? [])].sort(),
    });
  }

  return attributes;
}

/** Finds the active variant that exactly matches every selected attribute. */
export function matchVariant(
  variants: readonly SelectorVariant[],
  selection: Readonly<Record<string, string>>,
): SelectorVariant | null {
  const selected = Object.entries(selection).filter(([, value]) => value !== "");
  if (selected.length === 0) return null;

  const matches = variants.filter((variant) =>
    selected.every(([key, value]) => variant.attributes[key] === value),
  );

  return matches.length === 1 ? matches[0] : null;
}

/**
 * Options of one attribute that still lead to a real variant given the current
 * selection on the other attributes. The selector uses this to disable
 * combinations that cannot be fulfilled instead of letting a visitor reach a
 * dead end at "Add to cart".
 */
export function availableOptionsFor(
  attributes: readonly SelectorAttribute[],
  variants: readonly SelectorVariant[],
  selection: Readonly<Record<string, string>>,
  key: string,
): string[] {
  const attribute = attributes.find((item) => item.key === key);
  if (!attribute) return [];

  const others = Object.entries(selection).filter(
    ([otherKey, value]) => otherKey !== key && value !== "",
  );

  return attribute.options.filter((option) =>
    variants.some(
      (variant) =>
        variant.attributes[key] === option &&
        others.every(([otherKey, value]) => variant.attributes[otherKey] === value),
    ),
  );
}

/** Human-readable attribute summary, e.g. "Size: M · Color: Black". */
export function describeAttributes(
  attributes: Readonly<Record<string, string>>,
  schema: readonly CategoryAttribute[] = [],
): string {
  const labels = new Map(schema.map((attribute) => [attribute.key, attribute.label]));

  return Object.entries(attributes)
    .filter(([, value]) => typeof value === "string" && value.trim() !== "")
    .map(([key, value]) => `${labels.get(key) ?? key}: ${value}`)
    .join(" · ");
}

export type AvailabilityTone = "in" | "low" | "out";

export interface Availability {
  label: string;
  tone: AvailabilityTone;
  orderable: boolean;
}

/** Public-friendly stock display that never exposes exact reorder internals. */
export function describeAvailability(stock: number): Availability {
  if (stock <= 0) return { label: "Out of stock", tone: "out", orderable: false };
  if (stock <= 5) return { label: `Only ${stock} left`, tone: "low", orderable: true };
  return { label: "In stock", tone: "in", orderable: true };
}

/** Effective (sale-aware) price, guarded against invalid stored data. */
export function displayPricePaisa(variant: SelectorVariant): number {
  try {
    return effectivePricePaisa(variant.pricePaisa, variant.salePricePaisa);
  } catch {
    return variant.pricePaisa;
  }
}

// ---------------------------------------------------------------------------
// Listing filters (applied in JS over a bounded active-variant scan)
// ---------------------------------------------------------------------------

export interface PriceFilterVariant {
  product_id: string;
  price_paisa: number;
  sale_price_paisa: number | null;
  stock: number;
  is_active: boolean;
}

/** Returns product ids whose variants satisfy the optional price/stock filters. */
export function filterProductsByVariantCriteria(
  variants: readonly PriceFilterVariant[],
  filters: { minPaisa?: number | null; maxPaisa?: number | null; inStockOnly?: boolean },
): string[] {
  const ids = new Set<string>();

  for (const variant of variants) {
    if (!variant.is_active) continue;
    if (filters.inStockOnly && variant.stock <= 0) continue;

    let price: number;
    try {
      price = effectivePricePaisa(variant.price_paisa, variant.sale_price_paisa);
    } catch {
      continue;
    }

    if (filters.minPaisa !== null && filters.minPaisa !== undefined && price < filters.minPaisa) continue;
    if (filters.maxPaisa !== null && filters.maxPaisa !== undefined && price > filters.maxPaisa) continue;

    ids.add(variant.product_id);
  }

  return [...ids];
}
