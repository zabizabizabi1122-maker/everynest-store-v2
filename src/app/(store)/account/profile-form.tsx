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

import { updateProfileAction } from "./actions";

interface ProfileFormProps {
  defaultFullName: string;
  defaultPhone: string;
}

export function ProfileForm({ defaultFullName, defaultPhone }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialFormState);

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <FormMessage status={state.status} message={state.message} />

      <Field id="fullName" label="Full name" error={errorFor("fullName")}>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={state.values?.fullName ?? defaultFullName}
          aria-invalid={Boolean(errorFor("fullName"))}
          aria-describedby={fieldDescribedBy("fullName", errorFor("fullName"))}
          className={inputClass}
        />
      </Field>

      <Field
        id="phone"
        label="Mobile number"
        hint="Pakistani mobile, for example 0300 1234567. Leave empty to remove it."
        error={errorFor("phone")}
      >
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={32}
          defaultValue={state.values?.phone ?? defaultPhone}
          aria-invalid={Boolean(errorFor("phone"))}
          aria-describedby={fieldDescribedBy("phone", errorFor("phone"), "phone hint")}
          className={inputClass}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </button>
        <span className="text-xs text-[color:var(--muted)]">Only name and phone can be changed.</span>
      </div>
    </form>
  );
}
