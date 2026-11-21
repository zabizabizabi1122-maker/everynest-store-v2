import { z } from "zod";

import type { CategoryAttribute } from "@/lib/category-schema";
import { rupeesToPaisa } from "@/lib/money";
import { skuSchema, uuidSchema } from "@/lib/validators";

/**
 * Level 5 — variant input normalization.
 *
 * The database trigger `private.guard_variant_attributes()` applies the same
 * rules as the final authority. These helpers give the admin form immediate,
 * friendly feedback and keep the submitted JSON shape consistent.
 */

export type VariantAttributes = Record<string, string>;

export type NormalizeResult =
  | { success: true; data: VariantAttributes }
  | { success: false; message: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalizes variant values against the effective category schema. */
export function normalizeVariantAttributes(
  value: unknown,
  schema: readonly CategoryAttribute[],
): NormalizeResult {
  if (!isPlainObject(value)) {
    return { success: false, message: "Attributes must be an object." };
  }

  const allowed = new Map(schema.map((attribute) => [attribute.key, attribute]));

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      return { success: false, message: `Attribute "${key}" is not part of this category schema.` };
    }
  }

  const normalized: VariantAttributes = {};

  for (const attribute of schema) {
    const raw = value[attribute.key];
    const text = typeof raw === "string" ? raw.trim() : "";

    if (!text) {
      if (attribute.required) {
        return { success: false, message: `Attribute "${attribute.label}" is required.` };
      }
      continue;
    }

    const canonical = attribute.options.find((option) => option.toLowerCase() === text.toLowerCase());

    if (!canonical) {
      return { success: false, message: `"${text}" is not a valid option for "${attribute.label}".` };
    }

    normalized[attribute.key] = canonical;
  }

  return { success: true, data: normalized };
}

export const variantFormRowSchema = z.object({
  id: z.string(),
  sku: skuSchema,
  attributes: z.record(z.string(), z.string()),
  price: z.string(),
  salePrice: z.string(),
  reorderLevel: z.string(),
  isActive: z.boolean(),
});

export type VariantFormRow = z.infer<typeof variantFormRowSchema>;

export interface ParsedVariant {
  id: string | null;
  sku: string;
  attributes: VariantAttributes;
  pricePaisa: number;
  salePricePaisa: number | null;
  reorderLevel: number;
  isActive: boolean;
}

export type VariantParseResult =
  | { success: true; data: ParsedVariant[] }
  | { success: false; message: string };

/** Validates and converts the variant rows submitted by the product editor. */
export function parseVariantRows(
  value: unknown,
  schema: readonly CategoryAttribute[],
): VariantParseResult {
  const parsed = z.array(variantFormRowSchema).max(50).safeParse(value);

  if (!parsed.success) {
    return { success: false, message: "Please check the variant fields." };
  }

  const result: ParsedVariant[] = [];
  const skus = new Set<string>();
  const attributeSets = new Set<string>();

  for (const [index, row] of parsed.data.entries()) {
    const label = `Variant ${index + 1}`;
    const id = row.id === "" ? null : uuidSchema.safeParse(row.id);

    if (id && !id.success) {
      return { success: false, message: `${label} has an invalid identifier.` };
    }

    let pricePaisa: number;
    let salePricePaisa: number | null = null;

    try {
      pricePaisa = rupeesToPaisa(row.price);
      if (row.salePrice.trim() !== "") {
        salePricePaisa = rupeesToPaisa(row.salePrice);
      }
    } catch {
      return { success: false, message: `${label} has an invalid price.` };
    }

    if (salePricePaisa !== null && salePricePaisa >= pricePaisa) {
      return { success: false, message: `${label}: sale price must be lower than the regular price.` };
    }

    if (!/^\d+$/.test(row.reorderLevel.trim())) {
      return { success: false, message: `${label} has an invalid reorder level.` };
    }

    const reorderLevel = Number.parseInt(row.reorderLevel, 10);

    if (!Number.isSafeInteger(reorderLevel) || reorderLevel > 100000) {
      return { success: false, message: `${label} has an invalid reorder level.` };
    }

    const attributes = normalizeVariantAttributes(row.attributes, schema);

    if (!attributes.success) {
      return { success: false, message: `${label}: ${attributes.message}` };
    }

    if (skus.has(row.sku)) {
      return { success: false, message: `SKU "${row.sku}" is used by more than one variant.` };
    }
    skus.add(row.sku);

    const attributeKey = JSON.stringify(
      Object.keys(attributes.data).sort().map((key) => [key, attributes.data[key]]),
    );

    if (attributeSets.has(attributeKey)) {
      return { success: false, message: `${label} repeats the same attribute combination.` };
    }
    attributeSets.add(attributeKey);

    result.push({
      id: id ? id.data : null,
      sku: row.sku,
      attributes: attributes.data,
      pricePaisa,
      salePricePaisa,
      reorderLevel,
      isActive: row.isActive,
    });
  }

  return { success: true, data: result };
}
