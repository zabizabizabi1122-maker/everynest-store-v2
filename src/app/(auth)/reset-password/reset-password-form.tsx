"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/form";
import { initialFormState } from "@/lib/form-state";

import { updatePasswordAction } from "../forgot-password/password-actions";

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, initialFormState);

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];
  const passwordHint = "Use at least 8 characters.";

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <FormMessage status={state.status} message={state.message} />

      <Field id="password" label="New password" error={errorFor("password")} hint={passwordHint}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
          aria-invalid={Boolean(errorFor("password"))}
          aria-describedby={fieldDescribedBy("password", errorFor("password"), passwordHint)}
          className={inputClass}
        />
      </Field>

      <Field id="confirmPassword" label="Confirm new password" error={errorFor("confirmPassword")}>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
          aria-invalid={Boolean(errorFor("confirmPassword"))}
          aria-describedby={fieldDescribedBy("confirmPassword", errorFor("confirmPassword"))}
          className={inputClass}
        />
      </Field>

      <button type="submit" className={`${primaryButtonClass} w-full`} disabled={isPending}>
        {isPending ? "Updating password…" : "Update password"}
      </button>

      <p className="text-center text-xs text-[color:var(--muted)]">
        Need a new link?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-[color:var(--primary)] transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
        >
          Request another
        </Link>
      </p>
    </form>
  );
}
