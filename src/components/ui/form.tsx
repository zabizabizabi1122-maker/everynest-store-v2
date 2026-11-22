import type { ReactNode } from "react";

/**
 * Small presentational form pieces shared by the auth and account screens.
 *
 * They contain no hooks or data access, so the same components work inside
 * Server and Client Components.
 */

export const labelClass = "block text-sm font-medium text-[color:var(--foreground)]";

export const inputClass =
  "mt-1.5 block w-full rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2.5 text-sm text-[color:var(--foreground)] shadow-sm outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary)]/20 disabled:cursor-not-allowed disabled:opacity-60";

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-[10px] bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[color:var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-[10px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3.5 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/** Label + control + hint/error wiring with the correct ARIA attributes. */
export function Field({ id, label, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-[color:var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Describes an input for screen readers, combining hint and error text. */
export function fieldDescribedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

interface FormMessageProps {
  status: "idle" | "error" | "success";
  message: string | null;
}

/** Page-level feedback banner (never raw provider errors). */
export function FormMessage({ status, message }: FormMessageProps) {
  if (!message || status === "idle") return null;

  const tone =
    status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <p
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm ${tone}`}
    >
      {message}
    </p>
  );
}
