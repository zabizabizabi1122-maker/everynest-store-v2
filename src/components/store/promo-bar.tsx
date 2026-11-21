"use client";

import { useState } from "react";

/** Dismissible delivery announcement shown above the storefront header. */
export function PromoBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="bg-[color:var(--brand)] px-6 py-2 text-center text-xs font-medium text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3">
        <span aria-hidden="true">✦</span>
        <span>Free delivery on orders over Rs. 5,000 — cash on delivery nationwide.</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss announcement"
          className="rounded p-0.5 text-white/80 transition hover:bg-white/20 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-3.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
