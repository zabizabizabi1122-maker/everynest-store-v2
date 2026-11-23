"use client";

import { useState } from "react";

import { formatPkr } from "@/lib/money";

export interface PromoBarProps {
  /** Already formatted for display by the settings loader. */
  message?: string;
  /** When false the bar is not rendered at all. */
  enabled?: boolean;
}

/** Dismissible delivery announcement shown above the storefront header. */
export function PromoBar({
  message = `Free delivery over ${formatPkr(300_000)}`,
  enabled = true,
}: PromoBarProps) {
  const [visible, setVisible] = useState(true);

  if (!enabled || !visible) return null;

  return (
    <div className="promo-bar px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      <div className="relative mx-auto flex max-w-[1200px] items-center justify-center gap-2.5">
        <span aria-hidden="true" className="promo-sparkle text-[color:var(--accent)]">✦</span>
        <span>{message}</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss announcement"
          className="rounded p-0.5 text-white/75 transition hover:bg-[color:var(--surface)]/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-3.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
