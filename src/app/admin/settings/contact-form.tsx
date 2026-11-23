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

import { saveContactAction } from "./actions";

export type ContactInitial = {
  tagline: string;
  note: string;
  help: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
};

interface ContactFormProps {
  /** Null when no settings row exists yet; storefront defaults are in use. */
  initial: ContactInitial | null;
}

const sectionClass = "rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm";

const CONTACT_FIELDS: Array<{
  key: keyof ContactInitial;
  id: string;
  label: string;
  type: string;
  placeholder: string;
  wide?: boolean;
}> = [
  { key: "tagline", id: "contact-tagline", label: "Tagline", type: "text", placeholder: "Short line under the footer logo" },
  { key: "note", id: "contact-note", label: "Delivery note", type: "text", placeholder: "Delivery and payment information", wide: true },
  { key: "help", id: "contact-help", label: "Support note", type: "text", placeholder: "Where customers can get help", wide: true },
  { key: "email", id: "contact-email", label: "Email", type: "email", placeholder: "support@example.com" },
  { key: "phone", id: "contact-phone", label: "Phone", type: "tel", placeholder: "03001234567" },
  { key: "whatsapp", id: "contact-whatsapp", label: "WhatsApp number", type: "tel", placeholder: "03001234567" },
  { key: "address", id: "contact-address", label: "Address", type: "text", placeholder: "Optional physical address", wide: true },
];

export function ContactForm({ initial }: ContactFormProps) {
  const [state, formAction, isPending] = useActionState(saveContactAction, initialFormState);
  const errorFor = (name: string) => state.fieldErrors[name]?.[0];

  const saved = (key: keyof ContactInitial): string => {
    if (state.values?.[key] !== undefined) return state.values[key];
    return initial?.[key] ?? "";
  };

  return (
    <form action={formAction} noValidate className={sectionClass}>
      <h2 className="text-base font-semibold">Contact details</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Blank fields are hidden on the storefront. Email, phone and WhatsApp become real links when filled in.
      </p>

      <FormMessage status={state.status} message={state.message} />

      {!initial ? (
        <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          No contact settings are saved yet. The storefront currently uses its built-in text.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {CONTACT_FIELDS.map((field) => (
          <div key={field.key} className={field.wide ? "sm:col-span-2" : undefined}>
            <Field id={field.id} label={field.label} error={errorFor(field.key)}>
              <input
                id={field.id}
                name={field.key}
                type={field.type}
                maxLength={field.key === "email" ? 254 : field.key === "address" ? 300 : 500}
                defaultValue={saved(field.key)}
                placeholder={field.placeholder}
                aria-invalid={Boolean(errorFor(field.key))}
                aria-describedby={fieldDescribedBy(field.id, errorFor(field.key))}
                className={inputClass}
              />
            </Field>
          </div>
        ))}
      </div>

      <button type="submit" className={`${primaryButtonClass} mt-5`} disabled={isPending}>
        {isPending ? "Saving…" : "Save contact details"}
      </button>
    </form>
  );
}
