import { describe, expect, it } from "vitest";

import type { CategoryAttribute } from "./category-schema";
import {
  normalizeVariantAttributes,
  parseVariantRows,
  type VariantFormRow,
} from "./variant-attributes";

const schema: CategoryAttribute[] = [
  { key: "size", label: "Size", options: ["S", "M", "L"], required: true },
  { key: "color", label: "Color", options: ["Black", "White"], required: true },
  { key: "fit", label: "Fit", options: ["Regular", "Slim"], required: false },
];

function row(overrides: Partial<VariantFormRow> = {}): VariantFormRow {
  return {
    id: "",
    sku: "ZS-TEST-001",
    attributes: { size: "m", color: "black", fit: "" },
    price: "1,299.50",
    salePrice: "999",
    reorderLevel: "5",
    isActive: true,
    ...overrides,
  };
}

describe("normalizeVariantAttributes", () => {
  it("trims values and restores the canonical option casing", () => {
    const result = normalizeVariantAttributes(
      { size: "  m ", color: "BLACK", fit: " slim " },
      schema,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ size: "M", color: "Black", fit: "Slim" });
  });

  it("omits blank optional attributes", () => {
    const result = normalizeVariantAttributes({ size: "M", color: "White", fit: "  " }, schema);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ size: "M", color: "White" });
  });

  it("rejects unknown keys, missing required values and invalid options", () => {
    expect(normalizeVariantAttributes({ size: "M", color: "White", extra: "x" }, schema).success).toBe(false);
    expect(normalizeVariantAttributes({ size: "M" }, schema).success).toBe(false);
    expect(normalizeVariantAttributes({ size: "M", color: "Green" }, schema).success).toBe(false);
    expect(normalizeVariantAttributes([], schema).success).toBe(false);
  });
});

describe("parseVariantRows", () => {
  it("converts rupees to paisa and validates the sale price", () => {
    const result = parseVariantRows([row()], schema);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0]).toMatchObject({
      id: null,
      sku: "ZS-TEST-001",
      pricePaisa: 129950,
      salePricePaisa: 99900,
      reorderLevel: 5,
      attributes: { size: "M", color: "Black" },
    });
  });

  it("leaves sale price null when the field is blank", () => {
    const result = parseVariantRows([row({ salePrice: "  " })], schema);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].salePricePaisa).toBeNull();
  });

  it("rejects a sale price that is not lower than the regular price", () => {
    const result = parseVariantRows([row({ price: "999", salePrice: "999" })], schema);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.message).toContain("sale price must be lower");
  });

  it("rejects invalid money and reorder levels", () => {
    expect(parseVariantRows([row({ price: "12.345" })], schema).success).toBe(false);
    expect(parseVariantRows([row({ reorderLevel: "-1" })], schema).success).toBe(false);
    expect(parseVariantRows([row({ reorderLevel: "100001" })], schema).success).toBe(false);
  });

  it("rejects duplicate SKUs and duplicate attribute combinations", () => {
    const duplicateSku = parseVariantRows(
      [row(), row({ attributes: { size: "L", color: "White", fit: "" } })],
      schema,
    );
    expect(duplicateSku.success).toBe(false);
    if (!duplicateSku.success) expect(duplicateSku.message).toContain("more than one variant");

    const duplicateAttributes = parseVariantRows(
      [row(), row({ sku: "ZS-TEST-002", attributes: { size: "m", color: "BLACK" } })],
      schema,
    );
    expect(duplicateAttributes.success).toBe(false);
    if (!duplicateAttributes.success) expect(duplicateAttributes.message).toContain("attribute combination");
  });

  it("rejects invalid identifiers and propagates attribute errors", () => {
    expect(parseVariantRows([row({ id: "not-a-uuid" })], schema).success).toBe(false);

    const invalidAttribute = parseVariantRows(
      [row({ attributes: { size: "XL", color: "Black" } })],
      schema,
    );
    expect(invalidAttribute.success).toBe(false);
    if (!invalidAttribute.success) expect(invalidAttribute.message).toContain("not a valid option");
  });

  it("caps the number of variants", () => {
    const rows = Array.from({ length: 51 }, (_, index) =>
      row({ sku: `ZS-TEST-${index}`, attributes: { size: "M", color: "Black" } }),
    );

    expect(parseVariantRows(rows, schema).success).toBe(false);
  });
});
