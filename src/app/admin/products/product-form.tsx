"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import type { CategoryAttribute } from "@/lib/category-schema";
import { initialFormState } from "@/lib/form-state";
import { paisaToRupees } from "@/lib/money";

import { createProductAction, updateProductAction } from "./actions";

export interface InitialVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  pricePaisa: number;
  salePricePaisa: number | null;
  reorderLevel: number;
  isActive: boolean;
  stock: number;
}

interface VariantRow {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: string;
  salePrice: string;
  reorderLevel: string;
  isActive: boolean;
  stock: number;
}

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  categories: { id: string; name: string }[];
  categorySchemas: Record<string, CategoryAttribute[]>;
  /** Variants reinterpret their attributes against a schema, so the category is fixed once they exist. */
  lockedCategory: boolean;
  initial: {
    name: string;
    slug: string;
    categoryId: string;
    brand: string;
    description: string;
    isFeatured: boolean;
    isActive: boolean;
  };
  initialVariants: InitialVariant[];
  saved?: boolean;
}

function blankRow(): VariantRow {
  return {
    id: "",
    sku: "",
    attributes: {},
    price: "",
    salePrice: "",
    reorderLevel: "5",
    isActive: true,
    stock: 0,
  };
}

function rowsFromInitial(initial: readonly InitialVariant[]): VariantRow[] {
  return initial.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    attributes: { ...variant.attributes },
    price: paisaToRupees(variant.pricePaisa),
    salePrice: variant.salePricePaisa === null ? "" : paisaToRupees(variant.salePricePaisa),
    reorderLevel: String(variant.reorderLevel),
    isActive: variant.isActive,
    stock: variant.stock,
  }));
}

export function ProductForm({
  mode,
  productId,
  categories,
  categorySchemas,
  lockedCategory,
  initial,
  initialVariants,
  saved,
}: ProductFormProps) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const activeSchema = categorySchemas[categoryId] ?? [];

  // Controlled state means the whole variant editor survives a failed submit;
  // the server echoes text fields only. No effect is needed to restore rows.
  const [rows, setRows] = useState<VariantRow[]>(() =>
    initialVariants.length > 0 ? rowsFromInitial(initialVariants) : [blankRow()],
  );

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];
  const variantsError = errorFor("variants");
  const serializedVariants = JSON.stringify(
    rows.map(({ id, sku, attributes, price, salePrice, reorderLevel, isActive }) => ({
      id,
      sku,
      attributes,
      price,
      salePrice,
      reorderLevel,
      isActive,
    })),
  );

  function updateRow(index: number, patch: Partial<VariantRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateAttribute(index: number, key: string, value: string) {
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, attributes: { ...row.attributes, [key]: value } } : row,
      ),
    );
  }

  function handleCategoryChange(next: string) {
    setCategoryId(next);
    const keys = new Set((categorySchemas[next] ?? []).map((attribute) => attribute.key));
    setRows((current) =>
      current.map((row) => ({
        ...row,
        attributes: Object.fromEntries(
          Object.entries(row.attributes).filter(([key]) => keys.has(key)),
        ),
      })),
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-6" noValidate>
      {mode === "edit" ? <input type="hidden" name="id" value={productId} /> : null}
      <input type="hidden" name="variants" value={serializedVariants} />

      <FormMessage status={state.status} message={state.message} />

      {saved && state.status !== "success" ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Product created. Add gallery images below, then save any further changes.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Product name" error={errorFor("name")}>
          <input
            id="name"
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            defaultValue={state.values?.name ?? initial.name}
            aria-invalid={Boolean(errorFor("name"))}
            aria-describedby={fieldDescribedBy("name", errorFor("name"))}
            className={inputClass}
          />
        </Field>

        <Field
          id="slug"
          label="URL slug"
          hint="Lowercase letters, numbers and hyphens."
          error={errorFor("slug")}
        >
          <input
            id="slug"
            name="slug"
            type="text"
            required
            maxLength={80}
            defaultValue={state.values?.slug ?? initial.slug}
            aria-invalid={Boolean(errorFor("slug"))}
            aria-describedby={fieldDescribedBy("slug", errorFor("slug"), "slug-hint")}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {lockedCategory ? (
          <div>
            <Field id="category-display" label="Category" hint="Locked because variants already exist." error={errorFor("categoryId")}>
              <select id="category-display" value={categoryId} disabled className={`${inputClass} disabled:bg-neutral-50`}>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <input type="hidden" name="categoryId" value={categoryId} />
          </div>
        ) : (
          <Field
            id="categoryId"
            label="Category"
            hint="The selected category's attributes appear in the variant rows below."
            error={errorFor("categoryId")}
          >
            <select
              id="categoryId"
              name="categoryId"
              required
              value={categoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
              aria-invalid={Boolean(errorFor("categoryId"))}
              aria-describedby={fieldDescribedBy("categoryId", errorFor("categoryId"), "categoryId-hint")}
              className={inputClass}
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field id="brand" label="Brand (optional)" error={errorFor("brand")}>
          <input
            id="brand"
            name="brand"
            type="text"
            maxLength={100}
            defaultValue={state.values?.brand ?? initial.brand}
            aria-invalid={Boolean(errorFor("brand"))}
            className={inputClass}
          />
        </Field>
      </div>

      <Field id="description" label="Description (optional)" error={errorFor("description")}>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={state.values?.description ?? initial.description}
          aria-invalid={Boolean(errorFor("description"))}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap gap-6 rounded-xl border border-neutral-200 bg-neutral-50/70 px-4 py-3">
        <label className="inline-flex items-center gap-2.5 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={
              state.values?.isActive !== undefined
                ? state.values.isActive === "true"
                : initial.isActive
            }
            className="size-4 rounded border-neutral-300 text-[color:var(--brand)] focus:ring-[color:var(--brand)]"
          />
          Active (visible in the storefront)
        </label>
        <label className="inline-flex items-center gap-2.5 text-sm font-medium text-neutral-800">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={
              state.values?.isFeatured !== undefined
                ? state.values.isFeatured === "true"
                : initial.isFeatured
            }
            className="size-4 rounded border-neutral-300 text-[color:var(--brand)] focus:ring-[color:var(--brand)]"
          />
          Featured on the homepage
        </label>
      </div>

      <section aria-labelledby="variants-heading" className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="variants-heading" className="text-base font-semibold text-neutral-900">
              Variants ({rows.length})
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              SKU, prices and reorder level are editable. Stock is display-only and changes through Inventory.
            </p>
          </div>
          <button type="button" onClick={() => setRows((current) => [...current, blankRow()])} className={secondaryButtonClass}>
            + Add variant
          </button>
        </div>

        {variantsError ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {variantsError}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
            Add at least one variant before saving.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {rows.map((row, index) => (
              <div
                key={row.id || `new-${index}`}
                className={`rounded-xl border p-4 ${row.isActive ? "border-neutral-200 bg-neutral-50/60" : "border-amber-200 bg-amber-50/50"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {row.id ? `Variant ${index + 1}` : `New variant ${index + 1}`}
                    {row.id ? ` · ${row.stock} in stock` : ""}
                    {!row.isActive ? " · archived" : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      row.id
                        ? updateRow(index, { isActive: !row.isActive })
                        : setRows((current) => current.filter((_, i) => i !== index))
                    }
                    className="text-sm font-medium text-red-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    {row.id ? (row.isActive ? "Archive" : "Restore") : "Remove"}
                  </button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor={`sku-${index}`} className="block text-xs font-semibold text-neutral-700">SKU</label>
                    <input
                      id={`sku-${index}`}
                      value={row.sku}
                      onChange={(event) => updateRow(index, { sku: event.target.value })}
                      placeholder="ZS-SHIRT-M"
                      maxLength={64}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`price-${index}`} className="block text-xs font-semibold text-neutral-700">Regular price (Rs)</label>
                    <input
                      id={`price-${index}`}
                      value={row.price}
                      onChange={(event) => updateRow(index, { price: event.target.value })}
                      inputMode="decimal"
                      placeholder="1,299"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`sale-${index}`} className="block text-xs font-semibold text-neutral-700">Sale price (optional)</label>
                    <input
                      id={`sale-${index}`}
                      value={row.salePrice}
                      onChange={(event) => updateRow(index, { salePrice: event.target.value })}
                      inputMode="decimal"
                      placeholder="999"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`reorder-${index}`} className="block text-xs font-semibold text-neutral-700">Reorder level</label>
                    <input
                      id={`reorder-${index}`}
                      value={row.reorderLevel}
                      onChange={(event) => updateRow(index, { reorderLevel: event.target.value })}
                      inputMode="numeric"
                      className={inputClass}
                    />
                  </div>
                </div>

                {activeSchema.length > 0 ? (
                  <div className="mt-3 grid gap-3 border-t border-neutral-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
                    {activeSchema.map((attribute) => (
                      <div key={attribute.key}>
                        <label htmlFor={`attr-${index}-${attribute.key}`} className="block text-xs font-semibold text-neutral-700">
                          {attribute.label}
                          {attribute.required ? "" : " (optional)"}
                        </label>
                        <select
                          id={`attr-${index}-${attribute.key}`}
                          value={row.attributes[attribute.key] ?? ""}
                          onChange={(event) => updateAttribute(index, attribute.key, event.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select…</option>
                          {attribute.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(event) => updateRow(index, { isActive: event.target.checked })}
                    className="size-4 rounded border-neutral-300 text-[color:var(--brand)] focus:ring-[color:var(--brand)]"
                  />
                  {row.isActive
                    ? "Active (uncheck to archive this variant)"
                    : "Archived (tick to restore this variant)"}
                </label>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
        </button>
        <Link href="/admin/products" className={secondaryButtonClass}>
          Back to products
        </Link>
      </div>
    </form>
  );
}
