"use client";

import { useActionState } from "react";
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

import { createSupplierAction, updateSupplierAction } from "./actions";

interface SupplierFormProps {
  mode: "create" | "edit";
  supplierId?: string;
  initial: {
    name: string;
    phone: string;
    address: string;
    isActive: boolean;
  };
  saved?: boolean;
}

export function SupplierForm({ mode, supplierId, initial, saved }: SupplierFormProps) {
  const action = mode === "create" ? createSupplierAction : updateSupplierAction;
  const [state, formAction, isPending] = useActionState(action, initialFormState);
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
      {mode === "edit" ? <input type="hidden" name="id" value={supplierId} /> : null}

      <FormMessage status={state.status} message={state.message} />

      {saved ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Supplier created. You can edit it again at any time.
        </p>
      ) : null}

      <Field id="name" label="Supplier name" error={errorFor("name")}>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="phone"
          label="Phone (optional)"
          hint="Digits, spaces, hyphens and an optional leading +."
          error={errorFor("phone")}
        >
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={32}
            defaultValue={state.values?.phone ?? initial.phone}
            aria-invalid={Boolean(errorFor("phone"))}
            aria-describedby={fieldDescribedBy("phone", errorFor("phone"), "phone-hint")}
            className={inputClass}
          />
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
            Active supplier
          </label>
        </div>
      </div>

      <Field id="address" label="Address (optional)" error={errorFor("address")}>
        <textarea
          id="address"
          name="address"
          rows={3}
          maxLength={300}
          defaultValue={state.values?.address ?? initial.address}
          aria-invalid={Boolean(errorFor("address"))}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create supplier" : "Save changes"}
        </button>
        <Link href="/admin/suppliers" className={secondaryButtonClass}>
          Back to suppliers
        </Link>
      </div>
    </form>
  );
}
