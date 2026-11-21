import type { z } from "zod";

/**
 * Shape returned by every Server Action that backs a form.
 *
 * Server Actions are the trust boundary: the browser can post anything, so each
 * action validates its input with Zod and returns field-level errors instead of
 * throwing. Nothing raw from PostgreSQL or Supabase Auth is ever returned.
 */
export interface FormActionState {
  status: "idle" | "error" | "success";
  message: string | null;
  fieldErrors: Record<string, string[]>;
  /**
   * Values echoed back so a failed submission does not wipe the form.
   *
   * React resets uncontrolled fields after a form action. Passing the last
   * submitted values (never passwords) makes the reset land on the user's text
   * instead of an empty field.
   */
  values?: Record<string, string>;
}

export const initialFormState: FormActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  values: {},
};

/** Groups Zod issues by their first path segment so each field can show its error. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;

    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}

/** Reads a form value as a string without trusting its type. */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
