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

import { requestPasswordResetAction } from "./password-actions";

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialFormState,
  );

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <FormMessage status={state.status} message={state.message} />

      <Field id="email" label="Email" error={errorFor("email")}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isPending}
          defaultValue={state.values?.email ?? ""}
          aria-invalid={Boolean(errorFor("email"))}
          aria-describedby={fieldDescribedBy("email", errorFor("email"))}
          className={inputClass}
          placeholder="you@example.com"
        />
      </Field>

      <button type="submit" className={`${primaryButtonClass} w-full`} disabled={isPending}>
        {isPending ? "Sending link…" : "Send reset link"}
      </button>
    </form>
  );
}
