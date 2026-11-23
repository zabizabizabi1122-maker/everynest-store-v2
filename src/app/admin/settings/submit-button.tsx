"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/form";

interface PendingSubmitButtonProps {
  children: ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "link";
  className?: string;
  ariaLabel?: string;
}

/** Disables while the enclosing form action is in flight (no double submits). */
export function PendingSubmitButton({
  children,
  pendingLabel = "Saving…",
  disabled = false,
  variant = "primary",
  className,
  ariaLabel,
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  const classes =
    className ??
    (variant === "secondary"
      ? secondaryButtonClass
      : variant === "link"
        ? "text-sm font-medium text-[color:var(--brand)] transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        : primaryButtonClass);

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      aria-label={ariaLabel}
      className={classes}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
