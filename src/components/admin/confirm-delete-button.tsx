"use client";

import { useFormStatus } from "react-dom";

type ConfirmDeleteButtonProps = {
  label: string;
  busyLabel?: string;
  confirmText: string;
  className?: string;
};

const baseClass =
  "text-sm font-medium text-red-600 transition hover:text-red-800 hover:underline active:scale-95 motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60";

/** Submit button that requires confirmation and shows real pending state. */
export function ConfirmDeleteButton({
  label,
  busyLabel = "Deleting…",
  confirmText,
  className,
}: ConfirmDeleteButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className ? `${baseClass} ${className}` : baseClass}
      onClick={(event) => {
        if (!pending && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {pending ? busyLabel : label}
    </button>
  );
}
