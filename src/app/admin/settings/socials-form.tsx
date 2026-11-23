"use client";

import { useActionState, useRef, useState } from "react";

import {
  Field,
  FormMessage,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui/form";
import { initialFormState } from "@/lib/form-state";
import type { SocialIcon, SocialLink } from "@/lib/site-settings";

import { saveSocialsAction } from "./actions";

const ICON_OPTIONS = ["instagram", "facebook", "twitter"] as const;
const ICON_LABELS: Record<SocialIcon, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  twitter: "Twitter",
};

interface SocialItem extends SocialLink {
  key: string;
}

interface SocialsFormProps {
  /** Empty when no socials row exists yet; storefront shows decorative icons. */
  initial: SocialLink[];
}

export function SocialsForm({ initial }: SocialsFormProps) {
  const [state, formAction, isPending] = useActionState(saveSocialsAction, initialFormState);
  const [items, setItems] = useState<SocialItem[]>(() =>
    initial.map((item, index) => ({ ...item, key: `social-${index}` })),
  );
  const nextKey = useRef(initial.length);

  const update = (key: string, patch: Partial<SocialItem>) => {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const add = () => {
    setItems((current) =>
      current.length >= 12
        ? current
        : [...current, { key: `social-${nextKey.current++}`, label: "", url: "", icon: "instagram" }],
    );
  };

  const remove = (key: string) => {
    setItems((current) => current.filter((item) => item.key !== key));
  };

  const errorFor = (index: number, field: string) =>
    state.fieldErrors[`social-${index}-${field}`]?.[0];

  return (
    <form action={formAction} noValidate className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold">Social links</h2>
      <p className="mt-1 text-xs text-neutral-500">
        Use full http(s) URLs. A link with no URL stays as a decorative icon in the footer.
      </p>

      <FormMessage status={state.status} message={state.message} />
      {state.fieldErrors.socials?.[0] ? (
        <p role="alert" className="mt-3 text-sm text-red-600">{state.fieldErrors.socials[0]}</p>
      ) : null}

      {initial.length === 0 ? (
        <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          No social links are saved yet. The storefront currently shows its built-in decorative icons.
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
            No social links saved. Add one below if needed.
          </p>
        ) : null}

        {items.map((item, index) => (
          <div key={item.key} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
              <Field id={`${item.key}-label`} label="Label" error={errorFor(index, "label")}>
                <input
                  id={`${item.key}-label`}
                  name="socialLabel"
                  type="text"
                  maxLength={80}
                  value={item.label}
                  onChange={(event) => update(item.key, { label: event.target.value })}
                  aria-invalid={Boolean(errorFor(index, "label"))}
                  className={inputClass}
                />
              </Field>

              <Field id={`${item.key}-url`} label="URL" error={errorFor(index, "url")}>
                <input
                  id={`${item.key}-url`}
                  name="socialUrl"
                  type="url"
                  maxLength={500}
                  value={item.url}
                  onChange={(event) => update(item.key, { url: event.target.value })}
                  placeholder="https://instagram.com/your-store"
                  aria-invalid={Boolean(errorFor(index, "url"))}
                  className={inputClass}
                />
              </Field>

              <Field id={`${item.key}-icon`} label="Icon" error={errorFor(index, "icon")}>
                <select
                  id={`${item.key}-icon`}
                  name="socialIcon"
                  value={item.icon}
                  onChange={(event) =>
                    update(item.key, { icon: event.target.value as SocialIcon })
                  }
                  className={inputClass}
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>{ICON_LABELS[icon]}</option>
                  ))}
                </select>
              </Field>
            </div>

            <button
              type="button"
              onClick={() => remove(item.key)}
              disabled={isPending}
              className="mt-3 text-sm font-medium text-red-600 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={isPending || items.length >= 12}
          className={secondaryButtonClass}
        >
          Add social link
        </button>
        <button type="submit" className={primaryButtonClass} disabled={isPending}>
          {isPending ? "Saving…" : "Save social links"}
        </button>
      </div>
    </form>
  );
}
