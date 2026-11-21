"use client";

import { useActionState } from "react";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/form";
import { initialAddressState } from "@/lib/addresses";

import { createAddressAction } from "./actions";

/** Form for saving a reusable delivery address. */
export function AddressForm() {
  const [state, formAction, isPending] = useActionState(
    createAddressAction,
    initialAddressState,
  );
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} noValidate className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-900">Add an address</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Your first address becomes the default used to prefill checkout.
      </p>

      <div className="mt-5 grid gap-4">
        <FormMessage status={state.status} message={state.message} />

        <Field id="addressLabel" label="Label" error={errorFor("label")}>
          <input
            id="addressLabel"
            name="label"
            required
            maxLength={50}
            placeholder="Home or Office"
            className={inputClass}
            defaultValue={state.values?.label ?? ""}
            aria-invalid={Boolean(errorFor("label"))}
            aria-describedby={fieldDescribedBy("addressLabel", errorFor("label"))}
          />
        </Field>

        <Field id="addressFullName" label="Recipient name" error={errorFor("fullName")}>
          <input
            id="addressFullName"
            name="fullName"
            required
            maxLength={100}
            className={inputClass}
            defaultValue={state.values?.fullName ?? ""}
            aria-invalid={Boolean(errorFor("fullName"))}
            aria-describedby={fieldDescribedBy("addressFullName", errorFor("fullName"))}
          />
        </Field>

        <Field id="addressPhone" label="Mobile number" error={errorFor("phone")}>
          <input
            id="addressPhone"
            name="phone"
            required
            inputMode="tel"
            maxLength={32}
            placeholder="03xxxxxxxxx"
            className={inputClass}
            defaultValue={state.values?.phone ?? ""}
            aria-invalid={Boolean(errorFor("phone"))}
            aria-describedby={fieldDescribedBy("addressPhone", errorFor("phone"))}
          />
        </Field>

        <Field id="addressCity" label="City" error={errorFor("city")}>
          <input
            id="addressCity"
            name="city"
            required
            maxLength={100}
            className={inputClass}
            defaultValue={state.values?.city ?? ""}
            aria-invalid={Boolean(errorFor("city"))}
            aria-describedby={fieldDescribedBy("addressCity", errorFor("city"))}
          />
        </Field>

        <Field id="addressStreet" label="Full address" error={errorFor("address")}>
          <textarea
            id="addressStreet"
            name="address"
            required
            rows={3}
            maxLength={500}
            placeholder="House number, street, area"
            className={inputClass}
            defaultValue={state.values?.address ?? ""}
            aria-invalid={Boolean(errorFor("address"))}
            aria-describedby={fieldDescribedBy("addressStreet", errorFor("address"))}
          />
        </Field>
      </div>

      <button type="submit" className={`${primaryButtonClass} mt-5`} disabled={isPending}>
        {isPending ? "Saving…" : "Save address"}
      </button>
    </form>
  );
}
