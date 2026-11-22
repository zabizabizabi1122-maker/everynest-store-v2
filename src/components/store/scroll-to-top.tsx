"use client";

import { useEffect, useState } from "react";

/** Appears after scrolling; smoothly returns the visitor to the top. */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll back to top"
      className="animate-toast-in fixed bottom-6 right-6 z-40 grid size-11 place-items-center rounded-full bg-[color:var(--primary)] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[color:var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--primary)]"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="size-5">
        <path d="m6 15 6-6 6 6" />
      </svg>
    </button>
  );
}
