import { describe, expect, it } from "vitest";

import {
  categoryChain,
  descendantIds,
  describeSchemaChange,
  effectiveAttributes,
  fromSchemaJson,
  inheritedAttributes,
  mergeAttributes,
  parseCategorySchema,
  parseCategorySchemaText,
  toSchemaJson,
  type CategoryAttribute,
  type CategoryOption,
} from "./category-schema";

function attribute(
  key: string,
  options: string[],
  required = true,
): CategoryAttribute {
  return { key, label: key, options, required };
}

function category(
  id: string,
  parentId: string | null,
  attributes: CategoryAttribute[] = [],
): CategoryOption {
  return {
    id,
    name: id,
    slug: id,
    parent_id: parentId,
    is_active: true,
    attribute_schema: toSchemaJson(attributes),
  };
}

describe("parseCategorySchema", () => {
  it("normalizes keys, trims options and defaults required to true", () => {
    const result = parseCategorySchema([
      { key: " Size ", label: " Size ", options: [" S ", "M", " XL "] },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toEqual([{ key: "size", label: "Size", options: ["S", "M", "XL"], required: true }]);
  });

  it("respects an explicit optional flag", () => {
    const result = parseCategorySchema([
      { key: "color", label: "Color", options: ["Black"], required: false },
    ]);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data[0].required).toBe(false);
  });

  it("rejects invalid keys, duplicate options and unknown fields", () => {
    expect(parseCategorySchema([{ key: "Bad-Key", label: "Bad", options: ["A"] }]).success).toBe(false);
    expect(parseCategorySchema([{ key: "size", label: "Size", options: ["S", "s"] }]).success).toBe(false);
    expect(
      parseCategorySchema([{ key: "size", label: "Size", options: ["S"], role: "admin" }]).success,
    ).toBe(false);
    expect(parseCategorySchema([]).success).toBe(true);
  });

  it("reads legacy schemas that have no required field", () => {
    const attributes = fromSchemaJson([{ key: "size", label: "Size", options: ["S", "M"] }]);
    expect(attributes[0]?.required).toBe(true);
  });

  it("reports invalid JSON from the editor", () => {
    const result = parseCategorySchemaText("{not json");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.attributeSchema).toBeDefined();
  });
});

describe("category tree helpers", () => {
  const categories = [
    category("root", null, [attribute("size", ["S", "M"])]),
    category("child", "root", [attribute("color", ["Black"])]),
    category("grandchild", "child", []),
    category("other", null, []),
  ];

  it("returns a root-first chain", () => {
    expect(categoryChain(categories, "grandchild").map((item) => item.id)).toEqual([
      "root",
      "child",
      "grandchild",
    ]);
  });

  it("stops instead of looping when the data contains a cycle", () => {
    const cyclic = [category("a", "b"), category("b", "a")];
    expect(categoryChain(cyclic, "a").map((item) => item.id)).toEqual(["b", "a"]);
  });

  it("finds descendants without including the category itself", () => {
    expect(descendantIds(categories, "root").sort()).toEqual(["child", "grandchild"]);
    expect(descendantIds(categories, "grandchild")).toEqual([]);
  });

  it("returns the parent's full effective schema for a child", () => {
    expect(inheritedAttributes(categories, "child").map((item) => item.key)).toEqual([
      "size",
      "color",
    ]);
    expect(effectiveAttributes(categories, "child").attributes.map((item) => item.key)).toEqual([
      "size",
      "color",
    ]);
  });
});

describe("mergeAttributes", () => {
  it("lets a child extend an inherited option list but keeps the required flag", () => {
    const inherited = [attribute("size", ["S", "M"], true)];
    const own = [attribute("size", ["S", "M", "L"], false)];

    const result = mergeAttributes(inherited, own);

    expect(result.conflicts).toEqual([]);
    expect(result.attributes[0]).toEqual(attribute("size", ["S", "M", "L"], true));
  });

  it("reports a child that removes an inherited option or tightens a rule", () => {
    const inherited = [attribute("size", ["S", "M"], false)];
    const own = [attribute("size", ["S"], false), attribute("size", ["S", "M"], true)];

    const result = mergeAttributes(inherited, own);

    expect(result.conflicts).toEqual(["size", "size"]);
    expect(result.attributes[0]).toEqual(inherited[0]);
  });
});

describe("describeSchemaChange with existing variants", () => {
  const current = [
    attribute("size", ["S", "M"], true),
    attribute("color", ["Black"], false),
  ];

  it("allows any change when no variants exist", () => {
    expect(describeSchemaChange(current, [], false)).toBeNull();
  });

  it("blocks removing or renaming an existing key", () => {
    expect(describeSchemaChange(current, [current[1]], true)).toContain("cannot be removed or renamed");
  });

  it("blocks removing an existing option", () => {
    const next = [attribute("size", ["S"], true), current[1]];
    expect(describeSchemaChange(current, next, true)).toContain("Options cannot be removed");
  });

  it("blocks making an optional attribute required", () => {
    const next = [current[0], attribute("color", ["Black"], true)];
    expect(describeSchemaChange(current, next, true)).toContain("cannot become required");
  });

  it("requires new attributes to be optional", () => {
    const next = [...current, attribute("material", ["Cotton"], true)];
    expect(describeSchemaChange(current, next, true)).toContain("must be optional");

    const allowed = [...current, attribute("material", ["Cotton"], false)];
    expect(describeSchemaChange(current, allowed, true)).toBeNull();
  });

  it("allows extending option lists", () => {
    const next = [attribute("size", ["S", "M", "L"], true), current[1]];
    expect(describeSchemaChange(current, next, true)).toBeNull();
  });
});
