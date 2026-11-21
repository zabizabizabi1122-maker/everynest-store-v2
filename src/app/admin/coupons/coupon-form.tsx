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

import { createCouponAction } from "./actions";

/** Admin-only coupon creation form. All amounts are entered in paisa. */
export function CouponForm() {
  const [state, formAction, isPending] = useActionState(createCouponAction, initialFormState);
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} noValidate className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">Create a coupon</h2>
      <p className="mt-1 text-xs text-neutral-500">Discount amounts are entered in paisa (100 = Rs. 1).</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <FormMessage status={state.status} message={state.message} />

        <Field id="code" label="Code" error={errorFor("code")}>
          <input
            id="code"
            name="code"
            required
            maxLength={30}
            placeholder="SAVE10"
            className={`${inputClass} uppercase`}
            aria-invalid={Boolean(errorFor("code"))}
            aria-describedby={fieldDescribedBy("code", errorFor("code"))}
          />
        </Field>

        <Field id="discountType" label="Discount type" error={errorFor("discountType")}>
          <select id="discountType" name="discountType" className={inputClass} defaultValue="percent">
            <option value="percent">Percent (1–100)</option>
            <option value="fixed_paisa">Fixed amount (paisa)</option>
          </select>
        </Field>

        <Field id="discountValue" label="Discount value" error={errorFor("discountValue")}>
          <input
            id="discountValue"
            name="discountValue"
            required
            inputMode="numeric"
            placeholder="10"
            className={inputClass}
            aria-invalid={Boolean(errorFor("discountValue"))}
            aria-describedby={fieldDescribedBy("discountValue", errorFor("discountValue"))}
          />
        </Field>

        <Field id="minSubtotalPaisa" label="Minimum subtotal (paisa)" error={errorFor("minSubtotalPaisa")}>
          <input
            id="minSubtotalPaisa"
            name="minSubtotalPaisa"
            inputMode="numeric"
            defaultValue="0"
            className={inputClass}
            aria-invalid={Boolean(errorFor("minSubtotalPaisa"))}
            aria-describedby={fieldDescribedBy("minSubtotalPaisa", errorFor("minSubtotalPaisa"))}
          />
        </Field>

        <Field id="maxUses" label="Maximum uses (blank = unlimited)" error={errorFor("maxUses")}>
          <input
            id="maxUses"
            name="maxUses"
            inputMode="numeric"
            className={inputClass}
            aria-invalid={Boolean(errorFor("maxUses"))}
            aria-describedby={fieldDescribedBy("maxUses", errorFor("maxUses"))}
          />
        </Field>

        <Field id="endsAt" label="Expires at (optional)" error={errorFor("endsAt")}>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            className={inputClass}
            aria-invalid={Boolean(errorFor("endsAt"))}
            aria-describedby={fieldDescribedBy("endsAt", errorFor("endsAt"))}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field id="description" label="Description (optional)" error={errorFor("description")}>
            <input id="description" name="description" maxLength={200} className={inputClass} />
          </Field>
        </div>
      </div>

      <button type="submit" className={`${primaryButtonClass} mt-5`} disabled={isPending}>
        {isPending ? "Saving…" : "Create coupon"}
      </button>
    </form>
  );
}
