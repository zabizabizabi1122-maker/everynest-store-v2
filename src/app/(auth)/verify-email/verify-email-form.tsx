"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import {
  Field,
  FormMessage,
  fieldDescribedBy,
  inputClass,
  primaryButtonClass,
} from "@/components/ui/form";
import { initialFormState, type FormActionState } from "@/lib/form-state";

import { resendVerificationAction } from "../verification-actions";

const RESEND_COOLDOWN_SECONDS = 60;

interface VerifyEmailFormProps {
  initialEmail: string;
  notice: string | null;
}

export function VerifyEmailForm({ initialEmail, notice }: VerifyEmailFormProps) {
  const [cooldown, setCooldown] = useState(0);
  const isCoolingDown = cooldown > 0;

  // Start the visible 60-second cooldown only after a successful submission.
  // This runs in the form action callback, not inside an effect.
  const submitAction = async (
    previous: FormActionState,
    formData: FormData,
  ): Promise<FormActionState> => {
    const result = await resendVerificationAction(previous, formData);
    if (result.status === "success") setCooldown(RESEND_COOLDOWN_SECONDS);
    return result;
  };

  const [state, formAction, isPending] = useActionState(submitAction, initialFormState);

  useEffect(() => {
    if (!isCoolingDown) return;

    const timer = window.setInterval(() => {
      setCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isCoolingDown]);

  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  return (
    <form action={formAction} className="mt-6 space-y-4" noValidate>
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {notice}
        </p>
      ) : null}

      <FormMessage status={state.status} message={state.message} />

      <Field id="verify-email" label="Admin email" error={errorFor("email")}>
        <input
          id="verify-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email ?? initialEmail}
          aria-invalid={Boolean(errorFor("email"))}
          aria-describedby={fieldDescribedBy("verify-email", errorFor("email"))}
          className={inputClass}
          placeholder="you@example.com"
        />
      </Field>

      <button
        type="submit"
        className={`${primaryButtonClass} w-full`}
        disabled={isPending || cooldown > 0}
      >
        {isPending
          ? "Sending link…"
          : cooldown > 0
            ? `Resend available in ${cooldown}s`
            : "Resend verification link"}
      </button>

      <p className="text-center text-sm text-[color:var(--muted)]">
        <Link
          href="/login"
          className="font-medium text-[color:var(--primary)] transition hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
