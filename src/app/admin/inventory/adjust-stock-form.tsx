"use client";

import { useActionState } from "react";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/form";
import { initialFormState } from "@/lib/form-state";
import { STOCK_REASONS, STOCK_REASON_LABELS } from "@/lib/inventory";

import { adjustStockAction } from "./actions";

interface AdjustStockFormProps {
  variants: { id: string; label: string }[];
  suppliers: { id: string; name: string }[];
}

/** Only the RPC is called here; stock is never part of a direct table update. */
export function AdjustStockForm({ variants, suppliers }: AdjustStockFormProps) {
  const [state, formAction, isPending] = useActionState(adjustStockAction, initialFormState);
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} className="mt-4 space-y-4 border-t border-neutral-200 pt-4" noValidate>
      <h3 className="text-sm font-semibold text-neutral-900">Receive or adjust stock</h3>
      <p className="text-xs text-neutral-600">
        Every change is recorded in the movement history. Negative values remove stock and fail if
        the requested quantity is unavailable.
      </p>

      <FormMessage status={state.status} message={state.message} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="variantId" label="Variant" error={errorFor("variantId")}>
          <select
            id="variantId"
            name="variantId"
            required
            defaultValue={state.values?.variantId ?? variants[0]?.id ?? ""}
            aria-invalid={Boolean(errorFor("variantId"))}
            aria-describedby={fieldDescribedBy("variantId", errorFor("variantId"))}
            className={inputClass}
          >
            {variants.length === 0 ? <option value="">No variants available</option> : null}
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="reason"
          label="Reason"
          hint="Purchase receives stock; return and adjustment can go either way."
          error={errorFor("reason")}
        >
          <select
            id="reason"
            name="reason"
            defaultValue={state.values?.reason ?? "purchase"}
            aria-describedby={fieldDescribedBy("reason", errorFor("reason"), "reason-hint")}
            className={inputClass}
          >
            {STOCK_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {STOCK_REASON_LABELS[reason]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="change"
          label="Units (+ to add, − to remove)"
          hint="Enter a non-zero whole number, for example 24 or -3."
          error={errorFor("change")}
        >
          <input
            id="change"
            name="change"
            type="text"
            inputMode="numeric"
            required
            defaultValue={state.values?.change ?? "1"}
            aria-invalid={Boolean(errorFor("change"))}
            aria-describedby={fieldDescribedBy("change", errorFor("change"), "change-hint")}
            className={inputClass}
          />
        </Field>

        <Field id="supplierId" label="Supplier (optional)" error={errorFor("supplierId")}>
          <select
            id="supplierId"
            name="supplierId"
            defaultValue={state.values?.supplierId ?? ""}
            className={inputClass}
          >
            <option value="">None</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id="note" label="Note (optional)" error={errorFor("note")}>
        <input
          id="note"
          name="note"
          type="text"
          maxLength={300}
          defaultValue={state.values?.note ?? ""}
          aria-invalid={Boolean(errorFor("note"))}
          className={inputClass}
        />
      </Field>

      <button type="submit" className={primaryButtonClass} disabled={isPending || variants.length === 0}>
        {isPending ? "Saving…" : "Apply stock change"}
      </button>
    </form>
  );
}
