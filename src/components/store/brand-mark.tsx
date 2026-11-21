import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizeClass: Record<NonNullable<BrandMarkProps["size"]>, string> = {
  sm: "size-5",
  md: "size-7",
  lg: "size-9",
};

/**
 * Shared brand emblem + wordmark.
 *
 * The emblem is a shopping bag with a checkmark: it reads as "store" at any
 * size and never needs an icon package. Decorative only — the wordmark is
 * always rendered too, so the mark stays accessible.
 */
export function BrandMark({
  className,
  variant = "dark",
  size = "md",
  showText = true,
}: BrandMarkProps) {
  const stroke = variant === "light" ? "#ffffff" : "currentColor";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={sizeClass[size]}
      >
        <path d="M7 10a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V10z" />
        <path d="M16 6v4" />
        <path d="m13 17 2.5 2.5L19 15" />
      </svg>
      {showText ? <span className="font-semibold tracking-tight">EveryNest</span> : null}
    </span>
  );
}