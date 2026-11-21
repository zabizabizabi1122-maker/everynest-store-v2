import { describe, expect, it } from "vitest";

import type { CategoryAttribute } from "./category-schema";
import {
  availableOptionsFor,
  buildSelectorAttributes,
  clampPage,
  describeAttributes,
  describeAvailability,
  displayPricePaisa,
  filterProductsByVariantCriteria,
  matchVariant,
  PAGE_SIZE,
  parsePaisaFilter,
  parsePositiveInt,
  parseSort,
  sanitizeSearch,
  type SelectorVariant,
} from "./storefront";

const schema: CategoryAttribute[] = [
  { key: "size", label: "Size", options: ["S", "M", "L"], required: true },
  { key: "color", label: "Color", options: ["Black", "White"], required: true },
];

function variant(overrides: Partial<SelectorVariant> = {}): SelectorVariant {
  return {
    id: "b0000000-0000-4000-8000-000000000001",
    sku: "ZS-TEST-001",
    attributes: { size: "M", color: "Black" },
    pricePaisa: 129950,
    salePricePaisa: 99900,
    stock: 4,
    ...overrides,
  };
}

describe("listing query helpers", () => {
  it("parses and clamps query parameters", () => {
    expect(parseSort("price-asc")).toBe("price-asc");
    expect(parseSort("nonsense")).toBe("newest");
    expect(parsePositiveInt("3", 1)).toBe(3);
    expect(parsePositiveInt("0", 1)).toBe(1);
    expect(parsePositiveInt(undefined, 1)).toBe(1);
    expect(clampPage(99, 4)).toBe(4);
    expect(clampPage(-2, 4)).toBe(1);
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });

  it("parses paisa price filters as rupees", () => {
    expect(parsePaisaFilter("1500")).toBe(150000);
    expect(parsePaisaFilter("1,299.50")).toBe(129950);
    expect(parsePaisaFilter("Rs. 1,500")).toBe(150000);
    expect(parsePaisaFilter("")).toBe(null);
    expect(parsePaisaFilter("-5")).toBe(null);
    expect(parsePaisaFilter("abc")).toBe(null);
  });

  it("sanitizes search input for PostgREST patterns", () => {
    expect(sanitizeSearch("  Cotton%_shirt  ")).toBe("Cotton shirt");
    expect(sanitizeSearch("(a,b)")).toBe("a b");
    expect(sanitizeSearch(undefined)).toBe("");
  });
});

describe("variant selector", () => {
  const variants = [
    variant(),
    variant({ id: "v2", attributes: { size: "M", color: "White" }, salePricePaisa: null }),
    variant({ id: "v3", attributes: { size: "L", color: "Black" } }),
  ];

  it("only offers options that exist on a variant", () => {
    const attributes = buildSelectorAttributes(schema, variants);

    expect(attributes).toEqual([
      { key: "size", label: "Size", options: ["M", "L"] },
      { key: "color", label: "Color", options: ["Black", "White"] },
    ]);
  });

  it("includes extra attribute keys from variants", () => {
    const withExtra = [...variants, variant({ id: "v4", attributes: { size: "M", color: "Black", fit: "Slim" } })];
    const attributes = buildSelectorAttributes(schema, withExtra);

    expect(attributes.at(-1)).toEqual({ key: "fit", label: "Fit", options: ["Slim"] });
  });

  it("matches a single variant exactly", () => {
    expect(matchVariant(variants, { size: "M", color: "White" })?.id).toBe("v2");
    expect(matchVariant(variants, { size: "S", color: "Black" })).toBeNull();
    expect(matchVariant(variants, {})).toBeNull();
  });

  it("only enables options that lead to a real variant", () => {
    const attributes = buildSelectorAttributes(schema, variants);

    expect(availableOptionsFor(attributes, variants, {}, "size")).toEqual(["M", "L"]);
    expect(availableOptionsFor(attributes, variants, { color: "White" }, "size")).toEqual(["M"]);
    expect(availableOptionsFor(attributes, variants, { size: "L" }, "color")).toEqual(["Black"]);
    expect(availableOptionsFor(attributes, variants, {}, "unknown")).toEqual([]);
  });

  it("describes attributes with schema labels", () => {
    expect(describeAttributes({ size: "M", color: "Black" }, schema)).toBe("Size: M · Color: Black");
    expect(describeAttributes({ fit: "Slim" })).toBe("fit: Slim");
  });

  it("uses sale price and guards invalid data", () => {
    expect(displayPricePaisa(variant())).toBe(99900);
    expect(displayPricePaisa(variant({ salePricePaisa: null }))).toBe(129950);
    expect(displayPricePaisa(variant({ salePricePaisa: 200000 }))).toBe(129950);
  });

  it("labels availability without oversharing", () => {
    expect(describeAvailability(0)).toMatchObject({ tone: "out", orderable: false });
    expect(describeAvailability(4)).toMatchObject({ tone: "low", orderable: true });
    expect(describeAvailability(20)).toMatchObject({ tone: "in", orderable: true });
  });
});

describe("variant criteria filtering", () => {
  const variants = [
    { product_id: "p1", price_paisa: 100000, sale_price_paisa: null, stock: 5, is_active: true },
    { product_id: "p2", price_paisa: 200000, sale_price_paisa: 150000, stock: 0, is_active: true },
    { product_id: "p3", price_paisa: 300000, sale_price_paisa: null, stock: 10, is_active: false },
  ];

  it("uses effective price for min/max filters", () => {
    expect(filterProductsByVariantCriteria(variants, { minPaisa: 150000 })).toEqual(["p2"]);
    expect(filterProductsByVariantCriteria(variants, { maxPaisa: 100000 })).toEqual(["p1"]);
  });

  it("respects availability and ignores inactive variants", () => {
    expect(filterProductsByVariantCriteria(variants, { inStockOnly: true })).toEqual(["p1"]);
    expect(filterProductsByVariantCriteria(variants, {})).toEqual(["p1", "p2"]);
  });
});
