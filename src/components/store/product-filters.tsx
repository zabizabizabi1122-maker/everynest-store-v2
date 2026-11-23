import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";
import type { CatalogFacets } from "@/lib/catalog";
import { enabledSortOptions } from "@/lib/filters";
import type {
  FilterConfig,
  FilterDefinition,
  FilterOption,
  ParsedProductsParams,
} from "@/lib/filters";

/**
 * Server-rendered filter panel. Every control is a plain form field, so the
 * whole panel works with a normal GET navigation and needs no client JS.
 * Available definitions, options and sort orders all come from the database;
 * when none are configured the panel renders no fake choices.
 */

interface ProductFiltersProps {
  config: FilterConfig;
  categories: readonly { id: string; name: string }[];
  facets: CatalogFacets;
  selection: ParsedProductsParams;
  resultCount: number;
}

interface Choice {
  value: string;
  label: string;
  colorHex: string | null;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const sectionClass =
  "border-b border-[color:var(--border)] pb-5 last:border-b-0 last:pb-0";
const headingClass =
  "text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]";
const controlClass =
  "mt-1.5 block w-full rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20";

export function ProductFilters({
  config,
  categories,
  facets,
  selection,
  resultCount,
}: ProductFiltersProps) {
  const enabledSorts = enabledSortOptions(config);

  function choicesFor(definition: FilterDefinition): Choice[] {
    const saved = config.options
      .filter((option) => option.filterId === definition.id && option.isActive)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((option: FilterOption) => ({
        value: option.value,
        label: option.label,
        colorHex: option.colorHex,
      }));

    if (definition.type === "attribute" && definition.sourceKey === "category") {
      return categories.map((category) => ({
        value: category.id,
        label: category.name,
        colorHex: null,
      }));
    }

    const realValues =
      definition.type === "brand"
        ? facets.brands
        : definition.type === "attribute" && definition.sourceKey
          ? (facets.attributeValues[definition.sourceKey] ?? [])
          : [];

    for (const value of realValues) {
      if (saved.some((choice) => normalize(choice.value) === normalize(value))) continue;
      saved.push({ value, label: titleCase(value), colorHex: null });
    }

    return saved;
  }

  function selectedValues(definition: FilterDefinition): string[] {
    if (definition.type === "attribute" && definition.sourceKey === "category") {
      return selection.categoryIds;
    }
    if (definition.type === "brand") return selection.brands;
    if (definition.type === "attribute" && definition.sourceKey) {
      return selection.attributeValues[definition.sourceKey] ?? [];
    }
    return [];
  }

  function checked(definition: FilterDefinition, value: string): boolean {
    return selectedValues(definition).some((selected) => normalize(selected) === normalize(value));
  }

  function toggleChecked(definition: FilterDefinition): boolean {
    if (definition.type === "discount") return selection.discount;
    if (definition.type === "featured") return selection.featured;
    if (definition.type === "new_arrivals") return selection.newArrivals;
    if (definition.type === "availability") return selection.inStockOnly;
    return false;
  }

  const ratingDefinition = config.definitions.find((definition) => definition.type === "rating");
  const sliderMin = Math.min(facets.priceMinRupees, Number(selection.minRupees) || facets.priceMinRupees);
  const sliderMax = Math.max(
    facets.priceMaxRupees,
    Number(selection.maxRupees) || 0,
    sliderMin + 1,
  );

  return (
    <aside aria-label="Product filters" className="lg:sticky lg:top-6 lg:self-start">
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
        <h2 className="font-heading text-lg font-semibold">Filters</h2>
        <p aria-live="polite" className="mt-1 text-sm text-[color:var(--muted)]">
          {resultCount} {resultCount === 1 ? "product" : "products"} match
        </p>

        {selection.activeChips.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {selection.activeChips.map((chip) => (
              <li key={`${chip.label}-${chip.href}`}>
                <Link
                  href={chip.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--primary)] active:scale-95 motion-reduce:active:scale-100"
                >
                  {chip.label}
                  <span aria-hidden="true" className="text-[color:var(--muted)]">
                    ×
                  </span>
                  <span className="sr-only">Remove filter</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <form method="get" action="/products" className="mt-6 space-y-5" noValidate>
          {selection.q ? <input type="hidden" name="q" value={selection.q} /> : null}

          {enabledSorts.length > 0 ? (
            <section className={sectionClass}>
              <label htmlFor="filter-sort" className={headingClass}>
                Sort by
              </label>
              <select
                id="filter-sort"
                name="sort"
                defaultValue={selection.sort}
                className={controlClass}
              >
                {enabledSorts.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </section>
          ) : null}

          {config.definitions.length === 0 && enabledSorts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--background)] px-4 py-5 text-sm text-[color:var(--muted)]">
              No filters are configured yet.
            </p>
          ) : null}

          {config.definitions
            .slice()
            .sort((left, right) => left.displayOrder - right.displayOrder || left.key.localeCompare(right.key))
            .map((definition) => {
              const choices = choicesFor(definition);
              const inputType = definition.isMultiple ? "checkbox" : "radio";
              const name =
                definition.type === "attribute" && definition.sourceKey === "category"
                  ? "category"
                  : definition.type === "attribute"
                    ? (definition.sourceKey ?? definition.key)
                    : definition.key;
              const booleanChecked = toggleChecked(definition);

              // Rating uses a dedicated threshold section below.
              if (definition.type === "rating") return null;

              if (definition.type === "price") {
                return (
                  <section key={definition.id} className={sectionClass}>
                    <h3 className={headingClass}>{definition.label}</h3>
                    {definition.description ? (
                      <p className="mt-1 text-xs text-[color:var(--muted)]">{definition.description}</p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label htmlFor={`filter-min-${definition.id}`} className="text-xs text-[color:var(--muted)]">
                        Min (Rs.)
                        <input
                          id={`filter-min-${definition.id}`}
                          name="min"
                          type="number"
                          min={0}
                          step="1"
                          inputMode="numeric"
                          defaultValue={selection.minRupees}
                          placeholder={String(facets.priceMinRupees)}
                          className={controlClass}
                        />
                      </label>
                      <label htmlFor={`filter-max-${definition.id}`} className="text-xs text-[color:var(--muted)]">
                        Max (Rs.)
                        <input
                          id={`filter-max-${definition.id}`}
                          name="max"
                          type="number"
                          min={0}
                          step="1"
                          inputMode="numeric"
                          defaultValue={selection.maxRupees}
                          placeholder={String(facets.priceMaxRupees)}
                          className={controlClass}
                        />
                      </label>
                    </div>
                    <div className="mt-3 space-y-2">
                      <label htmlFor={`filter-min-range-${definition.id}`} className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                        <span className="w-8">Min</span>
                        <input
                          id={`filter-min-range-${definition.id}`}
                          name="minRange"
                          type="range"
                          min={sliderMin}
                          max={sliderMax}
                          step={1}
                          defaultValue={Number(selection.minRupees) || sliderMin}
                          className="h-2 w-full accent-[color:var(--primary)]"
                        />
                      </label>
                      <label htmlFor={`filter-max-range-${definition.id}`} className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
                        <span className="w-8">Max</span>
                        <input
                          id={`filter-max-range-${definition.id}`}
                          name="maxRange"
                          type="range"
                          min={sliderMin}
                          max={sliderMax}
                          step={1}
                          defaultValue={Number(selection.maxRupees) || sliderMax}
                          className="h-2 w-full accent-[color:var(--primary)]"
                        />
                      </label>
                    </div>
                  </section>
                );
              }

              if (
                definition.type === "availability" ||
                definition.type === "discount" ||
                definition.type === "featured" ||
                definition.type === "new_arrivals"
              ) {
                return (
                  <section key={definition.id} className={sectionClass}>
                    <h3 className={headingClass}>{definition.label}</h3>
                    <label className="mt-3 flex items-center gap-2.5 text-sm text-[color:var(--foreground)]">
                      <input
                        type="checkbox"
                        name={name}
                        value="true"
                        defaultChecked={booleanChecked}
                        className="size-4 rounded border-[color:var(--border)] accent-[color:var(--primary)]"
                      />
                      {definition.type === "availability" ? "In stock only" : definition.label}
                    </label>
                  </section>
                );
              }

              if (choices.length === 0) return null;

              return (
                <section key={definition.id} className={sectionClass}>
                  <h3 className={headingClass}>{definition.label}</h3>
                  <div className="mt-3 space-y-2.5">
                    {choices.map((choice) => (
                      <label
                        key={`${definition.id}-${choice.value}`}
                        htmlFor={`filter-${definition.id}-${choice.value}`}
                        className="group flex items-center gap-2.5 text-sm text-[color:var(--foreground)]"
                      >
                        <input
                          id={`filter-${definition.id}-${choice.value}`}
                          type={inputType}
                          name={name}
                          value={choice.value}
                          defaultChecked={checked(definition, choice.value)}
                          className="size-4 rounded border-[color:var(--border)] accent-[color:var(--primary)]"
                        />
                        {choice.colorHex ? (
                          <span
                            aria-hidden="true"
                            className="size-4 shrink-0 rounded-full border border-black/15 shadow-sm transition-transform group-hover:scale-110"
                            style={{ backgroundColor: choice.colorHex }}
                          />
                        ) : null}
                        <span className="truncate">{choice.label}</span>
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}

          {ratingDefinition ? (
            <section className={sectionClass}>
              <h3 className={headingClass}>{ratingDefinition.label}</h3>
              <div className="mt-3 space-y-2.5">
                {choicesFor(ratingDefinition).map((choice) => (
                  <label
                    key={`rating-${choice.value}`}
                    htmlFor={`filter-rating-${choice.value}`}
                    className="flex items-center gap-2.5 text-sm text-[color:var(--foreground)]"
                  >
                    <input
                      id={`filter-rating-${choice.value}`}
                      type="radio"
                      name="rating"
                      value={choice.value}
                      defaultChecked={selection.rating === choice.value}
                      className="size-4 border-[color:var(--border)] accent-[color:var(--primary)]"
                    />
                    {choice.label}
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          <div className="flex flex-col gap-2 pt-1">
            <button type="submit" className={`w-full ${primaryButtonClass}`}>
              Apply Filter
            </button>
            <Link href="/products" className={`w-full ${secondaryButtonClass}`}>
              Clear All
            </Link>
          </div>
        </form>
      </div>
    </aside>
  );
}
