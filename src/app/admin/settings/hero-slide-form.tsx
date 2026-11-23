"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { initialFormState } from "@/lib/form-state";
import type { HeroSlideRow } from "@/lib/site-settings";

import { createHeroSlideAction, updateHeroSlideAction } from "./actions";

interface HeroSlideFormProps {
  mode: "create" | "edit";
  slide?: HeroSlideRow;
  onCancel?: () => void;
}

type FieldName =
  | "eyebrow"
  | "title"
  | "description"
  | "image"
  | "imageAlt"
  | "primaryLabel"
  | "primaryHref"
  | "secondaryLabel"
  | "secondaryHref"
  | "displayOrder";

export function HeroSlideForm({ mode, slide, onCancel }: HeroSlideFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    mode === "create" ? createHeroSlideAction : updateHeroSlideAction,
    initialFormState,
  );
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  useEffect(() => {
    if (mode === "create" && state.status === "success") formRef.current?.reset();
  }, [mode, state]);

  const initialValue = (key: FieldName): string => {
    if (state.values?.[key] !== undefined) return state.values[key];

    if (!slide) return key === "displayOrder" ? "0" : "";

    switch (key) {
      case "eyebrow": return slide.eyebrow ?? "";
      case "title": return slide.title;
      case "description": return slide.description ?? "";
      case "image": return slide.image;
      case "imageAlt": return slide.image_alt ?? "";
      case "primaryLabel": return slide.primary_label;
      case "primaryHref": return slide.primary_href;
      case "secondaryLabel": return slide.secondary_label ?? "";
      case "secondaryHref": return slide.secondary_href ?? "";
      case "displayOrder": return String(slide.display_order);
    }
  };

  const isActive =
    state.values?.isActive !== undefined
      ? state.values.isActive === "true"
      : (slide?.is_active ?? true);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className={mode === "create" ? "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm" : "mt-5 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"}
    >
      {mode === "edit" ? <input type="hidden" name="id" value={slide?.id ?? ""} /> : null}

      <h3 className="text-sm font-semibold">
        {mode === "create" ? "Add a hero slide" : "Edit hero slide"}
      </h3>

      <FormMessage status={state.status} message={state.message} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id={`${mode}-eyebrow`} label="Eyebrow" error={errorFor("eyebrow")}>
          <input
            id={`${mode}-eyebrow`}
            name="eyebrow"
            type="text"
            maxLength={120}
            defaultValue={initialValue("eyebrow")}
            aria-invalid={Boolean(errorFor("eyebrow"))}
            aria-describedby={fieldDescribedBy(`${mode}-eyebrow`, errorFor("eyebrow"))}
            className={inputClass}
          />
        </Field>

        <Field id={`${mode}-title`} label="Title" error={errorFor("title")}>
          <input
            id={`${mode}-title`}
            name="title"
            type="text"
            required
            maxLength={160}
            defaultValue={initialValue("title")}
            aria-invalid={Boolean(errorFor("title"))}
            aria-describedby={fieldDescribedBy(`${mode}-title`, errorFor("title"))}
            className={inputClass}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field id={`${mode}-description`} label="Description" error={errorFor("description")}>
            <textarea
              id={`${mode}-description`}
              name="description"
              rows={3}
              maxLength={600}
              defaultValue={initialValue("description")}
              aria-invalid={Boolean(errorFor("description"))}
              aria-describedby={fieldDescribedBy(`${mode}-description`, errorFor("description"))}
              className={inputClass}
            />
          </Field>
        </div>

        <Field id={`${mode}-image`} label="Image path" error={errorFor("image")}>
          <input
            id={`${mode}-image`}
            name="image"
            type="text"
            required
            maxLength={500}
            defaultValue={initialValue("image")}
            placeholder="/products/canvas-backpack.jpg"
            aria-invalid={Boolean(errorFor("image"))}
            aria-describedby={fieldDescribedBy(`${mode}-image`, errorFor("image"))}
            className={inputClass}
          />
        </Field>

        <Field id={`${mode}-imageAlt`} label="Image alt text" error={errorFor("imageAlt")}>
          <input
            id={`${mode}-imageAlt`}
            name="imageAlt"
            type="text"
            maxLength={200}
            defaultValue={initialValue("imageAlt")}
            aria-invalid={Boolean(errorFor("imageAlt"))}
            aria-describedby={fieldDescribedBy(`${mode}-imageAlt`, errorFor("imageAlt"))}
            className={inputClass}
          />
        </Field>

        <Field id={`${mode}-primaryLabel`} label="Primary button label" error={errorFor("primaryLabel")}>
          <input
            id={`${mode}-primaryLabel`}
            name="primaryLabel"
            type="text"
            required
            maxLength={80}
            defaultValue={initialValue("primaryLabel")}
            aria-invalid={Boolean(errorFor("primaryLabel"))}
            aria-describedby={fieldDescribedBy(`${mode}-primaryLabel`, errorFor("primaryLabel"))}
            className={inputClass}
          />
        </Field>

        <Field id={`${mode}-primaryHref`} label="Primary link" error={errorFor("primaryHref")}>
          <input
            id={`${mode}-primaryHref`}
            name="primaryHref"
            type="text"
            required
            maxLength={500}
            defaultValue={initialValue("primaryHref")}
            placeholder="/products"
            aria-invalid={Boolean(errorFor("primaryHref"))}
            aria-describedby={fieldDescribedBy(`${mode}-primaryHref`, errorFor("primaryHref"))}
            className={inputClass}
          />
        </Field>

        <Field id={`${mode}-secondaryLabel`} label="Secondary button label (optional)" error={errorFor("secondaryLabel")}>
          <input
            id={`${mode}-secondaryLabel`}
            name="secondaryLabel"
            type="text"
            maxLength={80}
            defaultValue={initialValue("secondaryLabel")}
            aria-invalid={Boolean(errorFor("secondaryLabel"))}
            aria-describedby={fieldDescribedBy(`${mode}-secondaryLabel`, errorFor("secondaryLabel"))}
            className={inputClass}
          />
        </Field>

        <Field id={`${mode}-secondaryHref`} label="Secondary link (optional)" error={errorFor("secondaryHref")}>
          <input
            id={`${mode}-secondaryHref`}
            name="secondaryHref"
            type="text"
            maxLength={500}
            defaultValue={initialValue("secondaryHref")}
            placeholder="/cart"
            aria-invalid={Boolean(errorFor("secondaryHref"))}
            aria-describedby={fieldDescribedBy(`${mode}-secondaryHref`, errorFor("secondaryHref"))}
            className={inputClass}
          />
        </Field>

        <Field
          id={`${mode}-displayOrder`}
          label="Display order"
          hint="Lower numbers appear first."
          error={errorFor("displayOrder")}
        >
          <input
            id={`${mode}-displayOrder`}
            name="displayOrder"
            type="number"
            step={1}
            defaultValue={initialValue("displayOrder")}
            aria-invalid={Boolean(errorFor("displayOrder"))}
            aria-describedby={fieldDescribedBy(
              `${mode}-displayOrder`,
              errorFor("displayOrder"),
              `${mode}-displayOrder-hint`,
            )}
            className={inputClass}
          />
        </Field>

        <div className="flex items-end pb-2.5">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={isActive}
              className="size-4 rounded border-neutral-300 text-[color:var(--brand)] focus:ring-[color:var(--brand)]"
            />
            Active (visible on the homepage)
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Add slide" : "Save changes"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
