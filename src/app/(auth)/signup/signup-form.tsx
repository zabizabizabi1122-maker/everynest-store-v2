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

import { signupAction } from "../actions";

interface SignupFormProps {
  nextPath: string;
}

export function SignupForm({ nextPath }: SignupFormProps) {
  const [state, formAction, isPending] = useActionState(signupAction, initialFormState);

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

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
          defaultValue={state.values?.fullName ?? ""}
          aria-invalid={Boolean(errorFor("fullName"))}
          aria-describedby={fieldDescribedBy("fullName", errorFor("fullName"))}
          className={inputClass}
          placeholder="Shahzaib Abrar"
        />
      </Field>

      <Field id="email" label="Email" error={errorFor("email")}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={state.values?.email ?? ""}
          aria-invalid={Boolean(errorFor("email"))}
          aria-describedby={fieldDescribedBy("email", errorFor("email"))}
          className={inputClass}
          placeholder="you@example.com"
        />
      </Field>

      <Field
        id="phone"
        label="Mobile number (optional)"
        hint="Pakistani mobile, for example 0300 1234567."
        error={errorFor("phone")}
      >
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          maxLength={32}
          defaultValue={state.values?.phone ?? ""}
          aria-invalid={Boolean(errorFor("phone"))}
          aria-describedby={fieldDescribedBy("phone", errorFor("phone"), "Pakistani mobile")}
          className={inputClass}
          placeholder="0300 1234567"
        />
      </Field>

      <Field
        id="password"
        label="Password"
        hint="At least 8 characters, with a letter and a number."
        error={errorFor("password")}
      >
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-invalid={Boolean(errorFor("password"))}
          aria-describedby={fieldDescribedBy("password", errorFor("password"), "At least 8 characters")}
          className={inputClass}
        />
      </Field>

      <Field id="confirmPassword" label="Confirm password" error={errorFor("confirmPassword")}>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-invalid={Boolean(errorFor("confirmPassword"))}
          aria-describedby={fieldDescribedBy("confirmPassword", errorFor("confirmPassword"))}
          className={inputClass}
        />
      </Field>

      <button type="submit" className={`${primaryButtonClass} w-full`} disabled={isPending}>
        {isPending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-xs text-[color:var(--muted)]">
        New accounts start as customers. Staff access is granted by the store owner.
      </p>
    </form>
  );
}
