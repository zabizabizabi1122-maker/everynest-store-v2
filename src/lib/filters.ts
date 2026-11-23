import { isSupabaseConfigured } from "@/lib/env";
import {
  parsePaisaFilter,
  parsePositiveInt,
  SORT_OPTIONS,
  type SortOption,
} from "@/lib/storefront";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validators";

/**
 * Dynamic storefront filter configuration.
 *
 * The definitions, options, category assignments and sort options all come from
 * the database. Nothing in this file invents a filter or an option: an empty
 * configuration renders an empty filter panel. Until `database.types.ts` is
 * regenerated, the four new tables are described by the narrow types below and
 * accessed through the single cast in `filterDb()`.
 */

export const FILTER_TYPES = [
  "attribute",
  "brand",
  "price",
  "availability",
  "rating",
  "featured",
  "discount",
  "new_arrivals",
] as const;

export type FilterType = (typeof FILTER_TYPES)[number];

export interface FilterDefinition {
  id: string;
  key: string;
  label: string;
  description: string | null;
  type: FilterType;
  sourceKey: string | null;
  isActive: boolean;
  isMultiple: boolean;
  appliesToAll: boolean;
  displayOrder: number;
  /** Categories from `filter_categories`; empty when the row applies globally. */
  categoryIds: string[];
}

export interface FilterOption {
  id: string;
  filterId: string;
  value: string;
  label: string;
  colorHex: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface SortOptionConfig {
  key: string;
  label: string;
  isActive: boolean;
  displayOrder: number;
}

export interface FilterConfig {
  definitions: FilterDefinition[];
  options: FilterOption[];
  sortOptions: SortOptionConfig[];
  /**
   * `filter_categories` is granted only to `authenticated` in the migration.
   * Guests cannot read assignments, so storefront scoping is skipped and all
   * active definitions are offered rather than silently hiding filters.
   */
  assignmentsAvailable: boolean;
}

export const EMPTY_FILTER_CONFIG: FilterConfig = {
  definitions: [],
  options: [],
  sortOptions: [],
  assignmentsAvailable: false,
};

/** Products added within this window count as new arrivals. */
export const NEW_ARRIVAL_DAYS = 30;

/** Product facts used to narrow the catalogue, one filter family per field. */
export interface ProductFilterCriteria {
  categoryIds: string[];
  brands: string[];
  /** Attribute source key -> accepted values (OR within a key, AND across keys). */
  attributes: Record<string, string[]>;
  minPaisa: number | null;
  maxPaisa: number | null;
  inStockOnly: boolean;
  minRating: number | null;
  hasDiscount: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
}

export const EMPTY_CRITERIA: ProductFilterCriteria = {
  categoryIds: [],
  brands: [],
  attributes: {},
  minPaisa: null,
  maxPaisa: null,
  inStockOnly: false,
  minRating: null,
  hasDiscount: false,
  isFeatured: false,
  isNewArrival: false,
};

// ---------------------------------------------------------------------------
// Narrow database access for the four new tables
// ---------------------------------------------------------------------------

interface FilterDefinitionRow {
  id: string;
  key: string;
  label: string;
  description: string | null;
  type: string;
  source_key: string | null;
  is_active: boolean;
  is_multiple: boolean;
  applies_to_all: boolean;
  display_order: number;
}

interface FilterOptionRow {
  id: string;
  filter_id: string;
  value: string;
  label: string;
  color_hex: string | null;
  display_order: number;
  is_active: boolean;
}

interface FilterCategoryRow {
  filter_id: string;
  category_id: string;
}

interface SortOptionRow {
  key: string;
  label: string;
  is_active: boolean;
  display_order: number;
}

interface FilterTables {
  filter_definitions: FilterDefinitionRow;
  filter_options: FilterOptionRow;
  filter_categories: FilterCategoryRow;
  sort_options: SortOptionRow;
}

export interface FilterDbError {
  code?: string;
  message: string;
}

interface ListResult<Row> {
  data: Row[] | null;
  error: FilterDbError | null;
}

interface SingleResult<Row> {
  data: Row | null;
  error: FilterDbError | null;
}

interface FilterQuery<Row> extends PromiseLike<ListResult<Row>> {
  select(columns?: string): FilterQuery<Row>;
  eq(column: string, value: string | number | boolean): FilterQuery<Row>;
  in(column: string, values: readonly string[]): FilterQuery<Row>;
  order(column: string, options?: { ascending?: boolean }): FilterQuery<Row>;
  insert(values: Record<string, unknown> | readonly Record<string, unknown>[]): FilterQuery<Row>;
  update(values: Record<string, unknown>): FilterQuery<Row>;
  delete(): FilterQuery<Row>;
  single(): PromiseLike<SingleResult<Row>>;
}

interface FilterDb {
  from<Table extends keyof FilterTables>(table: Table): FilterQuery<FilterTables[Table]>;
}

function filterDb(supabase: Awaited<ReturnType<typeof createClient>>): FilterDb {
  return supabase as unknown as FilterDb;
}

function isFilterType(value: string): value is FilterType {
  return (FILTER_TYPES as readonly string[]).includes(value);
}

function toDefinition(
  row: FilterDefinitionRow,
  assignments: readonly FilterCategoryRow[],
): FilterDefinition {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    type: isFilterType(row.type) ? row.type : "attribute",
    sourceKey: row.source_key,
    isActive: row.is_active,
    isMultiple: row.is_multiple,
    appliesToAll: row.applies_to_all,
    displayOrder: row.display_order,
    categoryIds: assignments
      .filter((assignment) => assignment.filter_id === row.id)
      .map((assignment) => assignment.category_id),
  };
}

function toOption(row: FilterOptionRow): FilterOption {
  return {
    id: row.id,
    filterId: row.filter_id,
    value: row.value,
    label: row.label,
    colorHex: row.color_hex,
    displayOrder: row.display_order,
    isActive: row.is_active,
  };
}

export interface LoadFilterConfigOptions {
  /** Admin screens need disabled rows too; the storefront never asks for them. */
  includeInactive?: boolean;
}

/** Loads the full active configuration, falling back to an empty one. */
export async function loadFilterConfig(
  configOptions: LoadFilterConfigOptions = {},
): Promise<FilterConfig> {
  if (!isSupabaseConfigured()) return EMPTY_FILTER_CONFIG;

  const db = filterDb(await createClient());
  const includeInactive = configOptions.includeInactive === true;

  let definitionsQuery = db.from("filter_definitions").select("*");
  let optionsQuery = db.from("filter_options").select("*");
  let sortsQuery = db.from("sort_options").select("*");

  if (!includeInactive) {
    definitionsQuery = definitionsQuery.eq("is_active", true);
    optionsQuery = optionsQuery.eq("is_active", true);
    sortsQuery = sortsQuery.eq("is_active", true);
  }

  const [definitions, options, sorts, assignments] = await Promise.all([
    definitionsQuery.order("display_order", { ascending: true }),
    optionsQuery.order("display_order", { ascending: true }),
    sortsQuery.order("display_order", { ascending: true }),
    db.from("filter_categories").select("filter_id, category_id"),
  ]);

  const assignmentsAvailable = assignments.error === null;
  const assignmentRows = assignments.data ?? [];

  return {
    definitions: (definitions.data ?? []).map((row) => toDefinition(row, assignmentRows)),
    options: (options.data ?? []).map(toOption),
    sortOptions: (sorts.data ?? []).map((row) => ({
      key: row.key,
      label: row.label,
      isActive: row.is_active,
      displayOrder: row.display_order,
    })),
    assignmentsAvailable,
  };
}

/**
 * Definitions applicable to the current category. Global definitions always
 * apply; category-specific ones are used only when the assignment table could
 * be read (see `FilterConfig.assignmentsAvailable`).
 */
export function visibleDefinitions(
  config: FilterConfig,
  categoryIds: readonly string[] = [],
): FilterDefinition[] {
  const selected = new Set(categoryIds);
  return config.definitions.filter(
    (definition) =>
      definition.appliesToAll ||
      !config.assignmentsAvailable ||
      definition.categoryIds.some((id) => selected.has(id)),
  );
}

/** Only sort keys the listing knows how to execute and that are enabled in DB. */
export function enabledSortOptions(config: FilterConfig): SortOptionConfig[] {
  return config.sortOptions
    .filter((option) => option.isActive && (SORT_OPTIONS as readonly string[]).includes(option.key))
    .sort((left, right) => left.displayOrder - right.displayOrder || left.key.localeCompare(right.key));
}

export function resolveSort(value: string | undefined, config: FilterConfig): SortOption {
  const enabled = enabledSortOptions(config);
  const match = enabled.find((option) => option.key === value);
  return (match?.key as SortOption | undefined) ?? "newest";
}

// ---------------------------------------------------------------------------
// Query-string parsing and links
// ---------------------------------------------------------------------------

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ActiveChip {
  label: string;
  href: string;
}

export interface ParsedProductsParams {
  q: string;
  categoryIds: string[];
  page: number;
  sort: SortOption;
  minPaisa: number | null;
  maxPaisa: number | null;
  minRupees: string;
  maxRupees: string;
  inStockOnly: boolean;
  rating: string;
  discount: boolean;
  featured: boolean;
  newArrivals: boolean;
  brands: string[];
  attributeValues: Record<string, string[]>;
  criteria: ProductFilterCriteria;
  activeChips: ActiveChip[];
}

function paramValues(params: RawSearchParams, key: string): string[] {
  const raw = params[key];
  const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  return [...new Set(values.filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean))].slice(0, 50);
}

function firstValue(params: RawSearchParams, key: string): string {
  return paramValues(params, key)[0] ?? "";
}

function truthy(value: string): boolean {
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function prettyValue(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function toURLSearchParams(params: RawSearchParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const values = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
    for (const value of values) {
      if (typeof value === "string" && value !== "") search.append(key, value);
    }
  }
  return search;
}

/**
 * Builds a storefront link while preserving untouched parameters. A `null`
 * change removes the key; arrays repeat it. `page` is only changed when the
 * caller says so, so filter links always restart at page one explicitly.
 */
export function productsHref(
  params: RawSearchParams,
  changes: Record<string, string | string[] | null> = {},
): string {
  const search = toURLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    search.delete(key);
    if (value === null) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, item);
  }
  const query = search.toString();
  return query ? `/products?${query}` : "/products";
}

/**
 * Turns the raw URL into validated selections. Values are accepted only when
 * a matching active definition exists in the database, so disabling a filter
 * also stops a stale URL from narrowing the catalogue.
 */
export function parseProductsParams(
  params: RawSearchParams,
  config: FilterConfig,
  categories: readonly { id: string; name: string }[] = [],
): ParsedProductsParams {
  const q = firstValue(params, "q").slice(0, 80);
  const categoryIds = paramValues(params, "category")
    .filter((value) => uuidSchema.safeParse(value).success)
    .slice(0, 20);
  const definitions = visibleDefinitions(config, categoryIds).filter((item) => item.isActive);
  const hasType = (type: FilterType) => definitions.some((item) => item.type === type);

  // Number fields are authoritative; the range sliders are a no-JS fallback.
  const minRupees = hasType("price")
    ? firstValue(params, "min") || firstValue(params, "minRange")
    : "";
  const maxRupees = hasType("price")
    ? firstValue(params, "max") || firstValue(params, "maxRange")
    : "";
  const minPaisa = parsePaisaFilter(minRupees);
  const maxPaisa = parsePaisaFilter(maxRupees);
  const inStockOnly = hasType("availability") && truthy(firstValue(params, "inStock"));

  const ratingRaw = hasType("rating") ? firstValue(params, "rating") : "";
  const ratingNumber = Number(ratingRaw);
  const minRating =
    ratingRaw !== "" && Number.isFinite(ratingNumber) && ratingNumber >= 1 && ratingNumber <= 5
      ? ratingNumber
      : null;

  const brands = hasType("brand") ? paramValues(params, "brand") : [];
  const attributes: Record<string, string[]> = {};
  for (const definition of definitions) {
    if (definition.type !== "attribute" || !definition.sourceKey || definition.sourceKey === "category") {
      continue;
    }
    const values = paramValues(params, definition.sourceKey);
    if (values.length > 0) attributes[definition.sourceKey] = values;
  }

  const criteria: ProductFilterCriteria = {
    categoryIds,
    brands,
    attributes,
    minPaisa,
    maxPaisa,
    inStockOnly,
    minRating,
    hasDiscount: hasType("discount") && truthy(firstValue(params, "discount")),
    isFeatured: hasType("featured") && truthy(firstValue(params, "featured")),
    isNewArrival: hasType("new_arrivals") && truthy(firstValue(params, "new_arrivals")),
  };

  const activeChips: ActiveChip[] = [];
  const optionLabel = (key: string, value: string): string => {
    const definition = definitions.find((item) => item.key === key || item.type === key);
    const option = config.options.find(
      (item) => item.filterId === definition?.id && item.value.toLowerCase() === value.toLowerCase(),
    );
    return option?.label ?? prettyValue(value);
  };
  const removeChip = (key: string, value: string | null) => {
    const remaining = value === null
      ? []
      : paramValues(params, key).filter((item) => item !== value);
    return productsHref(params, {
      [key]: remaining.length > 0 ? remaining : null,
      page: null,
    });
  };

  if (q) activeChips.push({ label: `Search: ${q}`, href: productsHref(params, { q: null, page: null }) });
  for (const id of categoryIds) {
    const name = categories.find((category) => category.id === id)?.name ?? "Category";
    activeChips.push({ label: `Category: ${name}`, href: removeChip("category", id) });
  }
  for (const value of brands) {
    activeChips.push({ label: `Brand: ${optionLabel("brand", value)}`, href: removeChip("brand", value) });
  }
  for (const [key, values] of Object.entries(attributes)) {
    for (const value of values) {
      activeChips.push({ label: `${optionLabel(key, key)}: ${optionLabel(key, value)}`, href: removeChip(key, value) });
    }
  }
  if (minRupees) activeChips.push({ label: `Min: Rs. ${minRupees}`, href: productsHref(params, { min: null, minRange: null, page: null }) });
  if (maxRupees) activeChips.push({ label: `Max: Rs. ${maxRupees}`, href: productsHref(params, { max: null, maxRange: null, page: null }) });
  if (inStockOnly) activeChips.push({ label: "In stock", href: productsHref(params, { inStock: null, page: null }) });
  if (minRating !== null) {
    activeChips.push({
      label: `${minRating}★ and above`,
      href: productsHref(params, { rating: null, page: null }),
    });
  }
  if (criteria.hasDiscount) activeChips.push({ label: "On sale", href: productsHref(params, { discount: null, page: null }) });
  if (criteria.isFeatured) activeChips.push({ label: "Featured", href: productsHref(params, { featured: null, page: null }) });
  if (criteria.isNewArrival) activeChips.push({ label: "New arrivals", href: productsHref(params, { new_arrivals: null, page: null }) });

  return {
    q,
    categoryIds,
    page: parsePositiveInt(firstValue(params, "page"), 1),
    sort: resolveSort(firstValue(params, "sort"), config),
    minPaisa,
    maxPaisa,
    minRupees,
    maxRupees,
    inStockOnly,
    rating: minRating === null ? "" : String(minRating),
    discount: criteria.hasDiscount,
    featured: criteria.isFeatured,
    newArrivals: criteria.isNewArrival,
    brands,
    attributeValues: attributes,
    criteria,
    activeChips,
  };
}

export function hasActiveCriteria(criteria: ProductFilterCriteria): boolean {
  return (
    criteria.categoryIds.length > 0 ||
    criteria.brands.length > 0 ||
    Object.keys(criteria.attributes).length > 0 ||
    criteria.minPaisa !== null ||
    criteria.maxPaisa !== null ||
    criteria.inStockOnly ||
    criteria.minRating !== null ||
    criteria.hasDiscount ||
    criteria.isFeatured ||
    criteria.isNewArrival
  );
}

// ---------------------------------------------------------------------------
// Admin mutations (all callers must already hold `filters.manage`)
// ---------------------------------------------------------------------------

export interface FilterDefinitionInput {
  key: string;
  label: string;
  description: string | null;
  type: FilterType;
  sourceKey: string | null;
  isActive: boolean;
  isMultiple: boolean;
  appliesToAll: boolean;
  displayOrder: number;
}

export interface FilterOptionInput {
  /** Existing option id, or null for a newly added row. */
  id: string | null;
  value: string;
  label: string;
  colorHex: string | null;
  displayOrder: number;
  isActive: boolean;
}

function definitionValues(input: FilterDefinitionInput): Record<string, unknown> {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    type: input.type,
    source_key: input.sourceKey,
    is_active: input.isActive,
    is_multiple: input.isMultiple,
    applies_to_all: input.appliesToAll,
    display_order: input.displayOrder,
  };
}

function optionValues(filterId: string, option: FilterOptionInput): Record<string, unknown> {
  return {
    filter_id: filterId,
    value: option.value,
    label: option.label,
    color_hex: option.colorHex,
    display_order: option.displayOrder,
    is_active: option.isActive,
  };
}

function assignmentValues(filterId: string, categoryId: string): Record<string, unknown> {
  return { filter_id: filterId, category_id: categoryId };
}

async function writeOptions(
  db: FilterDb,
  filterId: string,
  options: readonly FilterOptionInput[],
): Promise<FilterDbError | null> {
  const existing = await db.from("filter_options").select("id").eq("filter_id", filterId);
  if (existing.error) return existing.error;

  const kept = new Set(options.flatMap((option) => (option.id ? [option.id] : [])));
  const stale = (existing.data ?? []).filter((row) => !kept.has(row.id)).map((row) => row.id);
  if (stale.length > 0) {
    const removed = await db.from("filter_options").delete().in("id", stale);
    if (removed.error) return removed.error;
  }

  for (const option of options) {
    const result = option.id
      ? await db.from("filter_options").update(optionValues(filterId, option)).eq("id", option.id)
      : await db.from("filter_options").insert(optionValues(filterId, option));
    if (result.error) return result.error;
  }

  return null;
}

async function writeAssignments(
  db: FilterDb,
  filterId: string,
  categoryIds: readonly string[],
): Promise<FilterDbError | null> {
  const removed = await db.from("filter_categories").delete().eq("filter_id", filterId);
  if (removed.error) return removed.error;

  for (const categoryId of categoryIds) {
    const result = await db
      .from("filter_categories")
      .insert(assignmentValues(filterId, categoryId));
    if (result.error) return result.error;
  }

  return null;
}

/** Creates a definition with its options and category assignments. */
export async function insertFilterDefinition(
  input: FilterDefinitionInput,
  options: readonly FilterOptionInput[],
  categoryIds: readonly string[],
): Promise<{ id: string; error: FilterDbError | null }> {
  const db = filterDb(await createClient());
  const created = await db
    .from("filter_definitions")
    .insert(definitionValues(input))
    .select("id")
    .single();

  if (created.error || !created.data) {
    return {
      id: "",
      error: created.error ?? { message: "No filter row was returned." },
    };
  }

  const id = created.data.id;
  const optionError = await writeOptions(db, id, options);
  const error = optionError ?? (await writeAssignments(db, id, categoryIds));

  if (error) {
    // The FK cascade removes any options/assignments already written.
    await db.from("filter_definitions").delete().eq("id", id);
    return { id: "", error };
  }

  return { id, error: null };
}

/** Updates a definition and synchronises its options and category assignments. */
export async function updateFilterDefinition(
  id: string,
  input: FilterDefinitionInput,
  options: readonly FilterOptionInput[],
  categoryIds: readonly string[],
): Promise<FilterDbError | null> {
  const db = filterDb(await createClient());
  const updated = await db
    .from("filter_definitions")
    .update(definitionValues(input))
    .eq("id", id)
    .select("id");

  if (updated.error) return updated.error;

  const optionError = await writeOptions(db, id, options);
  if (optionError) return optionError;

  return writeAssignments(db, id, categoryIds);
}

export async function setFilterDefinitionActive(
  id: string,
  isActive: boolean,
): Promise<FilterDbError | null> {
  const db = filterDb(await createClient());
  const result = await db
    .from("filter_definitions")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id");
  return result.error;
}

/** Options and category rows cascade through their foreign keys. */
export async function deleteFilterDefinition(id: string): Promise<FilterDbError | null> {
  const db = filterDb(await createClient());
  const result = await db.from("filter_definitions").delete().eq("id", id);
  return result.error;
}

export function isDuplicateFilterKeyError(error: FilterDbError): boolean {
  return error.code === "23505";
}
