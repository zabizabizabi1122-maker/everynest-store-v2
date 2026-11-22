import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  className?: string;
  variant?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizeClass: Record<NonNullable<BrandMarkProps["size"]>, string> = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
};

/**
 * EveryNest wordmark.
 *
 * A soft rounded tile holds a small "nest" cradle and a single terracotta
 * detail; the name is set in the heading face. Decorative only — the text is
 * always rendered too, so the mark stays accessible. Same props as before.
 */
export function BrandMark({
  className,
  variant = "dark",
  size = "md",
  showText = true,
}: BrandMarkProps) {
  const light = variant === "light";
  const tile = light ? "rgba(255,255,255,0.14)" : "var(--primary)";
  const stroke = "#ffffff";
  const name = light ? "text-white" : "text-foreground";
  const accentWord = light ? "text-white/75" : "text-primary";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className={sizeClass[size]}
      >
        <rect x="1" y="1" width="30" height="30" rx="9" fill={tile} />
        <path
          d="M8.5 18.5c1.4 3.2 4.2 5 7.5 5s6.1-1.8 7.5-5"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M10 16.5c0-3.3 2.7-6 6-6s6 2.7 6 6"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="16" cy="15.5" r="2.4" fill="var(--accent)" />
      </svg>
      {showText ? (
        <span className={cn("font-heading text-lg font-semibold tracking-tight", name)}>
          Every<span className={accentWord}>Nest</span>
        </span>
      ) : null}
    </span>
  );
}
