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

import { savePromoAction } from "./actions";

interface PromoFormProps {
  /** Null when no settings row exists yet; the storefront uses built-in defaults. */
  initial: {
    message: string;
    shippingThresholdPaisa: number;
    enabled: boolean;
  } | null;
}

const sectionClass = "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm";

export function PromoForm({ initial }: PromoFormProps) {
  const [state, formAction, isPending] = useActionState(savePromoAction, initialFormState);
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  const saved = (key: "message" | "shippingThresholdPaisa"): string => {
    if (state.values?.[key] !== undefined) return state.values[key];
    if (!initial) return "";
    return key === "message" ? initial.message : String(initial.shippingThresholdPaisa);
  };

  const enabled =
    state.values?.enabled !== undefined
      ? state.values.enabled === "true"
      : (initial?.enabled ?? true);

  return (
    <form action={formAction} noValidate className={sectionClass}>
      <h2 className="text-base font-semibold">Promotional bar</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Shown above the store header. Use {"{amount}"} in the message to insert the formatted threshold.
      </p>

      <FormMessage status={state.status} message={state.message} />

      {!initial ? (
        <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          No promo settings are saved yet. The storefront currently uses its built-in default bar.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field
            id="promo-message"
            label="Message"
            hint="Example: Free delivery over {amount}"
            error={errorFor("message")}
          >
            <input
              id="promo-message"
              name="message"
              type="text"
              maxLength={300}
              defaultValue={saved("message")}
              placeholder="Enter the announcement text"
              aria-invalid={Boolean(errorFor("message"))}
              aria-describedby={fieldDescribedBy("promo-message", errorFor("message"), "promo-message-hint")}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          id="promo-threshold"
          label="Free delivery threshold (paisa)"
          hint="100 paisa = Rs. 1. Digits only."
          error={errorFor("shippingThresholdPaisa")}
        >
          <input
            id="promo-threshold"
            name="shippingThresholdPaisa"
            type="text"
            inputMode="numeric"
            defaultValue={saved("shippingThresholdPaisa")}
            placeholder="e.g. 300000"
            aria-invalid={Boolean(errorFor("shippingThresholdPaisa"))}
            aria-describedby={fieldDescribedBy(
              "promo-threshold",
              errorFor("shippingThresholdPaisa"),
              "promo-threshold-hint",
            )}
            className={inputClass}
          />
        </Field>

        <div className="flex items-end pb-2.5">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-neutral-800">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={enabled}
              className="size-4 rounded border-neutral-300 text-[color:var(--brand)] focus:ring-[color:var(--brand)]"
            />
            Show the promo bar
          </label>
        </div>
      </div>

      <button type="submit" className={`${primaryButtonClass} mt-5`} disabled={isPending}>
        {isPending ? "Saving…" : "Save promo"}
      </button>
    </form>
  );
}
