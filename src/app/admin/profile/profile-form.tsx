"use client";

import { useActionState } from "react";

import { primaryButtonClass } from "@/components/ui/form";
import type { FormActionState } from "@/lib/form-state";

import { updateMyProfileAction } from "./actions";

const inputClass =
  "mt-1 block w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm outline-none focus:border-[color:var(--brand)] focus:ring-2 focus:ring-[color:var(--brand)]/20";

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string;
  phone: string;
}) {
  const initial: FormActionState = { status: "idle", message: "", fieldErrors: {} };
  const [state, formAction, pending] = useActionState(updateMyProfileAction, initial);

  return (
    <form action={formAction} className="mt-6 max-w-xl space-y-5">
      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="profile-name" className="block text-xs font-semibold text-neutral-700">
          Full name
        </label>
        <input
          id="profile-name"
          name="fullName"
          defaultValue={state.values?.fullName ?? fullName}
          maxLength={120}
          className={inputClass}
        />
        {state.fieldErrors?.fullName?.length ? (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.fullName.join(", ")}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="profile-phone" className="block text-xs font-semibold text-neutral-700">
          Phone
        </label>
        <input
          id="profile-phone"
          name="phone"
          defaultValue={state.values?.phone ?? phone}
          maxLength={30}
          className={inputClass}
        />
        {state.fieldErrors?.phone?.length ? (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.phone.join(", ")}</p>
        ) : null}
      </div>

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
