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

import { createCategoryAction, updateCategoryAction } from "./actions";

interface AttributeRow {
  key: string;
  label: string;
  options: string;
  required: boolean;
}

interface CategoryFormProps {
  mode: "create" | "edit";
  categoryId?: string;
  parents: { id: string; name: string }[];
  initial: {
    name: string;
    slug: string;
    parentId: string;
    isActive: boolean;
    attributes: CategoryAttribute[];
  };
  inherited: CategoryAttribute[];
  effective: CategoryAttribute[];
  hasVariants: boolean;
  saved?: boolean;
}

function rowsFromAttributes(attributes: readonly CategoryAttribute[]): AttributeRow[] {
  return attributes.map((attribute) => ({
    key: attribute.key,
    label: attribute.label,
    options: attribute.options.join(", "),
    required: attribute.required,
  }));
}

function rowsToJson(rows: readonly AttributeRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      key: row.key,
      label: row.label,
      options: row.options.split(",").map((option) => option.trim()).filter(Boolean),
      required: row.required,
    })),
  );
}

export function CategoryForm({
  mode,
  categoryId,
  parents,
  initial,
  inherited,
  effective,
  hasVariants,
  saved,
}: CategoryFormProps) {
  const action = mode === "create" ? createCategoryAction : updateCategoryAction;
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [rows, setRows] = useState<AttributeRow[]>(() => rowsFromAttributes(initial.attributes));

  // Attribute rows are controlled inputs, so they survive a failed submission
  // without needing to be restored from the echoed form values.

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];
  const schemaError = errorFor("attributeSchema");

  function updateRow(index: number, patch: Partial<AttributeRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={formAction} className="mt-6 space-y-6" noValidate>
      {mode === "edit" ? <input type="hidden" name="id" value={categoryId} /> : null}
      <input type="hidden" name="attributeSchema" value={rowsToJson(rows)} />

      <FormMessage status={state.status} message={state.message} />

      {saved ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Category created. You can add child categories or continue editing its attributes.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Category name" error={errorFor("name")}>
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
          hint="Lowercase letters, numbers and hyphens, for example school-bags."
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
        <Field
          id="parentId"
          label="Parent category"
          hint="Leave empty for a top-level category. Inherited attributes are shown below."
          error={errorFor("parentId")}
        >
          <select
            id="parentId"
            name="parentId"
            defaultValue={state.values?.parentId ?? initial.parentId}
            aria-invalid={Boolean(errorFor("parentId"))}
            className={inputClass}
          >
            <option value="">None (top level)</option>
            {parents.map((parent) => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end pb-2">
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
        </div>
      </div>

      <section aria-labelledby="attribute-schema" className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="attribute-schema" className="text-base font-semibold text-neutral-900">
              Variant attributes
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Define the attributes staff must fill when creating variants. Keys are normalized to
              lowercase automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRows((current) => [...current, { key: "", label: "", options: "", required: true }])}
            className={secondaryButtonClass}
          >
            + Add attribute
          </button>
        </div>

        {hasVariants ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Variants already use this category. Existing keys and options cannot be removed or
            renamed, and new attributes must stay optional until variants are updated.
          </p>
        ) : null}

        {schemaError ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {schemaError}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
            No custom attributes yet. Products in this category can use a single default variant.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {rows.map((row, index) => (
              <div key={index} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`attr-key-${index}`} className="block text-xs font-semibold text-neutral-700">
                      Key
                    </label>
                    <input
                      id={`attr-key-${index}`}
                      value={row.key}
                      onChange={(event) => updateRow(index, { key: event.target.value })}
                      placeholder="size"
                      maxLength={40}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`attr-label-${index}`} className="block text-xs font-semibold text-neutral-700">
                      Label
                    </label>
                    <input
                      id={`attr-label-${index}`}
                      value={row.label}
                      onChange={(event) => updateRow(index, { label: event.target.value })}
                      placeholder="Size"
                      maxLength={60}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label htmlFor={`attr-options-${index}`} className="block text-xs font-semibold text-neutral-700">
                    Options (comma separated)
                  </label>
                  <input
                    id={`attr-options-${index}`}
                    value={row.options}
                    onChange={(event) => updateRow(index, { options: event.target.value })}
                    placeholder="S, M, L, XL"
                    className={inputClass}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(event) => updateRow(index, { required: event.target.checked })}
                      className="size-4 rounded border-neutral-300 text-[color:var(--brand)] focus:ring-[color:var(--brand)]"
                    />
                    Required for new variants
                  </label>
                  <button
                    type="button"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                    className="text-sm font-medium text-red-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {inherited.length > 0 ? (
          <div className="mt-5 border-t border-neutral-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Inherited from parent categories
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {inherited.map((attribute) => (
                <li
                  key={attribute.key}
                  className="rounded-full bg-[color:var(--brand-soft)] px-3 py-1 text-xs font-medium text-[color:var(--brand)]"
                >
                  {attribute.label}
                  {attribute.required ? "" : " (optional)"}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {mode === "edit" ? (
        <section aria-labelledby="effective-schema" className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h3 id="effective-schema" className="text-base font-semibold text-neutral-900">
            Effective schema ({effective.length})
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            This is what variant forms will require after the save completes.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {effective.map((attribute) => (
              <li key={attribute.key} className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700">
                {attribute.label}
                <span className="ml-1 text-neutral-400">· {attribute.options.join(" / ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create category" : "Save changes"}
        </button>
        <Link href="/admin/categories" className={secondaryButtonClass}>
          Back to categories
        </Link>
      </div>
    </form>
  );
}
