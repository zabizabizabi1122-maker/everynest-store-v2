import { z } from "zod";

import type { Json } from "@/types/database.types";

/**
 * Level 4 — category attribute schemas.
 *
 * A category stores its own attributes in `attribute_schema`. A child inherits
 * every ancestor attribute, so the effective schema is the merged parent chain.
 * The same rules are enforced in the database by
 * `supabase/migrations/20261120150000_level4_category_schema.sql`; this module
 * gives the admin UI immediate, friendly validation before a round trip.
 *
 * Attribute keys are canonical (lowercase letters/digits/underscores). Labels
 * stay human-readable, so `{"key":"size","label":"Size"}` can be displayed as
 * "Size" while variants store the normalized key `size`.
 */

export const ATTRIBUTE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const optionSchema = z
  .string()
  .trim()
  .min(1, "Option cannot be empty.")
  .max(60, "Option must be 60 characters or fewer.");

/**
 * `required` defaults to true so schemas written before Level 4 (the Level 1
 * seed data has no `required` field) keep their original meaning.
 */
export const categoryAttributeSchema = z
  .object({
    key: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Attribute key is required.")
      .max(40, "Attribute key must be 40 characters or fewer.")
      .regex(ATTRIBUTE_KEY_PATTERN, "Use lowercase letters, numbers and underscores; start with a letter."),
    label: z
      .string()
      .trim()
      .min(1, "Attribute label is required.")
      .max(60, "Attribute label must be 60 characters or fewer."),
    options: z
      .array(optionSchema)
      .min(1, "Add at least one option.")
      .max(30, "Use at most 30 options.")
      .refine((options) => new Set(options.map((option) => option.toLowerCase())).size === options.length, {
        message: "Duplicate options are not allowed.",
      }),
    required: z.boolean().default(true),
  })
  .strict();

export const attributeSchemaSchema = z.array(categoryAttributeSchema).max(20, "Use at most 20 attributes.");

export type CategoryAttribute = z.infer<typeof categoryAttributeSchema>;

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_schema?: Json;
}

export type SchemaResult =
  | { success: true; data: CategoryAttribute[] }
  | { success: false; message: string; fieldErrors: Record<string, string[]> };

function invalidSchema(message: string, issues: string[]): SchemaResult {
  return {
    success: false,
    message,
    fieldErrors: { attributeSchema: issues },
  };
}

/** Validates and normalizes a value read from a form or from the database. */
export function parseCategorySchema(value: unknown): SchemaResult {
  const parsed = attributeSchemaSchema.safeParse(value);

  if (parsed.success) {
    return { success: true, data: parsed.data };
  }

  return invalidSchema(
    "Please check the attribute schema.",
    parsed.error.issues.map((issue) => issue.message),
  );
}

/** Validates the JSON text submitted by the attribute-schema editor. */
export function parseCategorySchemaText(text: string): SchemaResult {
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    return invalidSchema("The attribute schema is not valid JSON.", ["Fix the schema and try again."]);
  }

  return parseCategorySchema(value);
}

/** Converts validated attributes to a JSONB-safe value for Supabase. */
export function toSchemaJson(attributes: readonly CategoryAttribute[]): Json {
  return attributes.map((attribute) => ({
    key: attribute.key,
    label: attribute.label,
    options: [...attribute.options],
    required: attribute.required,
  }));
}

/** Reads a database JSONB value; invalid stored data is ignored, never crashed on. */
export function fromSchemaJson(value: unknown): CategoryAttribute[] {
  const parsed = attributeSchemaSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Root-first ancestor chain ending with the requested category. */
export function categoryChain(categories: readonly CategoryOption[], id: string): CategoryOption[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const chain: CategoryOption[] = [];
  const visited = new Set<string>();

  let current = byId.get(id);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);

    if (!current.parent_id) break;
    current = byId.get(current.parent_id);
  }

  return chain;
}

/** Every descendant of a category, excluding the category itself. */
export function descendantIds(categories: readonly CategoryOption[], id: string): string[] {
  const children = new Map<string, string[]>();

  for (const category of categories) {
    if (!category.parent_id) continue;
    const siblings = children.get(category.parent_id) ?? [];
    siblings.push(category.id);
    children.set(category.parent_id, siblings);
  }

  const result: string[] = [];
  const queue = [...(children.get(id) ?? [])];
  const visited = new Set<string>([id]);

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next || visited.has(next)) continue;

    visited.add(next);
    result.push(next);
    queue.push(...(children.get(next) ?? []));
  }

  return result;
}

function containsOption(options: readonly string[], option: string): boolean {
  const canonical = option.toLowerCase();
  return options.some((existing) => existing.toLowerCase() === canonical);
}

/**
 * Merges child attributes into inherited ones.
 *
 * A child may add attributes and extend inherited option lists. It cannot drop
 * an inherited attribute, remove one of its options, or change its required
 * flag — those would invalidate variants created against the parent schema.
 * Conflicting duplicates are reported instead of silently accepted.
 */
export function mergeAttributes(
  inherited: readonly CategoryAttribute[],
  own: readonly CategoryAttribute[],
): { attributes: CategoryAttribute[]; conflicts: string[] } {
  const merged = new Map<string, CategoryAttribute>(inherited.map((attribute) => [attribute.key, attribute]));
  const conflicts: string[] = [];

  for (const attribute of own) {
    const base = merged.get(attribute.key);

    if (!base) {
      merged.set(attribute.key, attribute);
      continue;
    }

    const removedOptions = base.options.filter((option) => !containsOption(attribute.options, option));
    // Loosening a required attribute is harmless to existing variants;
    // tightening an optional one would make variants without a value invalid.
    const incompatible = removedOptions.length > 0 || (!base.required && attribute.required);

    if (incompatible) {
      conflicts.push(attribute.key);
      continue;
    }

    merged.set(attribute.key, {
      ...attribute,
      options: [...attribute.options],
      required: base.required,
    });
  }

  return { attributes: [...merged.values()], conflicts };
}

/** Effective schema of a category, including every inherited attribute. */
export function effectiveAttributes(
  categories: readonly CategoryOption[],
  id: string,
): { attributes: CategoryAttribute[]; conflicts: string[] } {
  let result: { attributes: CategoryAttribute[]; conflicts: string[] } = {
    attributes: [],
    conflicts: [],
  };

  for (const category of categoryChain(categories, id)) {
    const next = mergeAttributes(result.attributes, fromSchemaJson(category.attribute_schema));
    result = {
      attributes: next.attributes,
      conflicts: [...result.conflicts, ...next.conflicts],
    };
  }

  return result;
}

/** Attributes inherited from ancestors only (used to render read-only hints). */
export function inheritedAttributes(
  categories: readonly CategoryOption[],
  parentId: string | null,
): CategoryAttribute[] {
  if (!parentId) return [];

  // Everything the parent defines is inherited by the edited category,
  // including the parent's own attributes. `effectiveAttributes` already walks
  // the full ancestor chain, so reuse it instead of re-implementing the merge.
  return effectiveAttributes(categories, parentId).attributes;
}

/**
 * Friendly explanation of a rejected schema edit once variants exist.
 * Returns null when the edit is safe. The database trigger applies the same
 * rules as the final line of defence.
 */
export function describeSchemaChange(
  current: readonly CategoryAttribute[],
  next: readonly CategoryAttribute[],
  hasVariants: boolean,
): string | null {
  if (!hasVariants) return null;

  for (const before of current) {
    const after = next.find((attribute) => attribute.key === before.key);

    if (!after) {
      return `Attribute "${before.label}" cannot be removed or renamed because variants already use this category.`;
    }

    const removed = before.options.filter((option) => !containsOption(after.options, option));

    if (removed.length > 0) {
      return `Options cannot be removed from "${before.label}" while variants are using it.`;
    }

    if (!before.required && after.required) {
      return `"${before.label}" cannot become required until existing variants have a value for it.`;
    }
  }

  for (const after of next) {
    const existed = current.some((attribute) => attribute.key === after.key);

    if (!existed && after.required) {
      return `New attribute "${after.label}" must be optional until existing variants have been updated.`;
    }
  }

  return null;
}
