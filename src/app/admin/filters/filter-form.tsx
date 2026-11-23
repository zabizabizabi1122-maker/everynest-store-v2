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
import { initialFormState } from "@/lib/form-state";
import type { FilterOptionInput, FilterType } from "@/lib/filters";

import { createFilterAction, updateFilterAction } from "./actions";

/** Type choices mirror the database CHECK constraint on filter_definitions.type. */
const TYPE_CHOICES: readonly { value: FilterType; label: string }[] = [
  { value: "attribute", label: "Attribute" },
  { value: "brand", label: "Brand" },
  { value: "price", label: "Price" },
  { value: "availability", label: "Availability" },
  { value: "rating", label: "Rating" },
  { value: "featured", label: "Featured" },
  { value: "discount", label: "Discount" },
  { value: "new_arrivals", label: "New arrivals" },
];

interface OptionRow {
  id: string;
  value: string;
  label: string;
  colorHex: string;
  displayOrder: string;
  isActive: boolean;
}

interface FilterFormProps {
  mode: "create" | "edit";
  filterId?: string;
  categories: readonly { id: string; name: string }[];
  initial: {
    key: string;
    label: string;
    description: string;
    type: FilterType;
    sourceKey: string;
    isActive: boolean;
    isMultiple: boolean;
    appliesToAll: boolean;
    displayOrder: number;
    categoryIds: string[];
    options: FilterOptionInput[];
  };
  saved?: boolean;
}

function rowsFromOptions(options: readonly FilterOptionInput[]): OptionRow[] {
  return options.map((option) => ({
    id: option.id ?? "",
    value: option.value,
    label: option.label,
    colorHex: option.colorHex ?? "",
    displayOrder: String(option.displayOrder),
    isActive: option.isActive,
  }));
}

function rowsToJson(rows: readonly OptionRow[]): string {
  const options = rows.map((row) => ({
    id: row.id,
    value: row.value,
    label: row.label,
    colorHex: row.colorHex,
    displayOrder: Number.parseInt(row.displayOrder, 10) || 0,
    isActive: row.isActive,
  }));
  return JSON.stringify(options);
}

const checkboxClass =
  "size-4 rounded border-neutral-300 text-[color:var(--brand)] focus:ring-[color:var(--brand)]";

export function FilterForm({ mode, filterId, categories, initial, saved }: FilterFormProps) {
  const action = mode === "create" ? createFilterAction : updateFilterAction;
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const [rows, setRows] = useState<OptionRow[]>(() => rowsFromOptions(initial.options));

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];
  const value = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  const checked = (name: string, fallback: boolean) =>
    state.values?.[name] === undefined ? fallback : state.values[name] === "true";
  const selectedCategories = state.values?.categoryIds
    ? state.values.categoryIds.split(",").filter(Boolean)
    : initial.categoryIds;

  function updateRow(index: number, patch: Partial<OptionRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={formAction} className="mt-6 space-y-6" noValidate>
      {mode === "edit" ? <input type="hidden" name="id" value={filterId} /> : null}
      <input type="hidden" name="options" value={rowsToJson(rows)} />

      <FormMessage status={state.status} message={state.message} />

      {saved ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Filter created. Add its options below and they will appear on the storefront immediately.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="filter-label" label="Label" error={errorFor("label")}>
          <input
            id="filter-label"
            name="label"
            type="text"
            required
            maxLength={80}
            defaultValue={value("label", initial.label)}
            aria-invalid={Boolean(errorFor("label"))}
            aria-describedby={fieldDescribedBy("filter-label", errorFor("label"))}
            className={inputClass}
          />
        </Field>

        <Field
          id="filter-key"
          label="Key"
          hint="Lowercase letters, numbers and underscores, for example new_arrivals."
          error={errorFor("key")}
        >
          <input
            id="filter-key"
            name="key"
            type="text"
            required
            maxLength={60}
            defaultValue={value("key", initial.key)}
            aria-invalid={Boolean(errorFor("key"))}
            aria-describedby={fieldDescribedBy("filter-key", errorFor("key"), "filter-key-hint")}
            className={inputClass}
          />
        </Field>
      </div>

      <Field id="filter-description" label="Description" error={errorFor("description")}>
        <textarea
          id="filter-description"
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={value("description", initial.description)}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="filter-type" label="Type" error={errorFor("type")}>
          <select
            id="filter-type"
            name="type"
            defaultValue={value("type", initial.type)}
            className={inputClass}
          >
            {TYPE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="filter-source-key"
          label="Source key"
          hint="Required for attribute filters; must match a variant attribute key such as color."
          error={errorFor("sourceKey")}
        >
          <input
            id="filter-source-key"
            name="sourceKey"
            type="text"
            maxLength={60}
            defaultValue={value("sourceKey", initial.sourceKey)}
            aria-invalid={Boolean(errorFor("sourceKey"))}
            aria-describedby={fieldDescribedBy("filter-source-key", errorFor("sourceKey"), "filter-source-key-hint")}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="filter-display-order" label="Display order" error={errorFor("displayOrder")}>
          <input
            id="filter-display-order"
            name="displayOrder"
            type="number"
            min={-1000}
            max={10000}
            defaultValue={value("displayOrder", String(initial.displayOrder))}
            className={inputClass}
          />
        </Field>

        <div className="flex flex-wrap items-end gap-4 pb-2">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
            <input type="checkbox" name="isActive" defaultChecked={checked("isActive", initial.isActive)} className={checkboxClass} />
            Active
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
            <input type="checkbox" name="isMultiple" defaultChecked={checked("isMultiple", initial.isMultiple)} className={checkboxClass} />
            Multiple values
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-neutral-800">
            <input type="checkbox" name="appliesToAll" defaultChecked={checked("appliesToAll", initial.appliesToAll)} className={checkboxClass} />
            All categories
          </label>
        </div>
      </div>

      <section aria-labelledby="filter-categories" className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5">
        <h3 id="filter-categories" className="text-base font-semibold text-neutral-900">
          Assigned categories
        </h3>
        <p className="mt-1 text-sm text-neutral-600">
          Leave “All categories” checked above to show this filter everywhere. Otherwise choose the
          categories where it should appear.
        </p>
        {categories.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No categories exist yet.</p>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <label key={category.id} className="inline-flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  defaultChecked={selectedCategories.includes(category.id)}
                  className={checkboxClass}
                />
                {category.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="filter-options" className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="filter-options" className="text-base font-semibold text-neutral-900">
              Options
            </h3>
            <p className="mt-1 text-sm text-neutral-600">
              Values must match real catalogue data (brand, attribute value or rating threshold).
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setRows((current) => [
                ...current,
                { id: "", value: "", label: "", colorHex: "", displayOrder: String((current.length + 1) * 10), isActive: true },
              ])
            }
            className={secondaryButtonClass}
          >
            + Add option
          </button>
        </div>

        {errorFor("options") ? (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorFor("options")}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-6 text-center text-sm text-neutral-500">
            No options yet. Brands and attributes without saved options use real values from the catalogue.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {rows.map((row, index) => (
              <div key={`${row.id || "new"}-${index}`} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`option-value-${index}`} className="block text-xs font-semibold text-neutral-700">
                      Value
                    </label>
                    <input
                      id={`option-value-${index}`}
                      value={row.value}
                      onChange={(event) => updateRow(index, { value: event.target.value })}
                      placeholder="blue"
                      maxLength={100}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`option-label-${index}`} className="block text-xs font-semibold text-neutral-700">
                      Label
                    </label>
                    <input
                      id={`option-label-${index}`}
                      value={row.label}
                      onChange={(event) => updateRow(index, { label: event.target.value })}
                      placeholder="Blue"
                      maxLength={100}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`option-color-${index}`} className="block text-xs font-semibold text-neutral-700">
                      Colour (optional)
                    </label>
                    <input
                      id={`option-color-${index}`}
                      value={row.colorHex}
                      onChange={(event) => updateRow(index, { colorHex: event.target.value })}
                      placeholder="#2563EB"
                      maxLength={7}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor={`option-order-${index}`} className="block text-xs font-semibold text-neutral-700">
                      Order
                    </label>
                    <input
                      id={`option-order-${index}`}
                      type="number"
                      min={0}
                      max={10000}
                      value={row.displayOrder}
                      onChange={(event) => updateRow(index, { displayOrder: event.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      onChange={(event) => updateRow(index, { isActive: event.target.checked })}
                      className={checkboxClass}
                    />
                    Active
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
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create filter" : "Save changes"}
        </button>
        <Link href="/admin/filters" className={secondaryButtonClass}>
          Back to filters
        </Link>
      </div>
    </form>
  );
}
