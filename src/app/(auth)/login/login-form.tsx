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

import { loginAction } from "../actions";

interface LoginFormProps {
  nextPath: string;
  notice: string | null;
}

export function LoginForm({ nextPath, notice }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialFormState);

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {notice}
        </p>
      ) : null}

      <FormMessage status={state.status} message={state.message} />

      <Field id="email" label="Email" error={errorFor("email")}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? ""}
          aria-invalid={Boolean(errorFor("email"))}
          aria-describedby={fieldDescribedBy("email", errorFor("email"))}
          className={inputClass}
          placeholder="you@example.com"
        />
      </Field>

      <Field id="password" label="Password" error={errorFor("password")}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errorFor("password"))}
          aria-describedby={fieldDescribedBy("password", errorFor("password"))}
          className={inputClass}
        />
      </Field>

      <button type="submit" className={`${primaryButtonClass} w-full`} disabled={isPending}>
        {isPending ? "Logging in…" : "Log in"}
      </button>

      <p className="text-center text-xs text-neutral-500">
        Sessions are stored in secure, httpOnly cookies.
      </p>
    </form>
  );
}
