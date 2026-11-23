"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Branded top progress bar for App Router navigations and the initial render.
 *
 * It starts when an internal link is clicked (or browser Back/Forward is used),
 * creeps toward 92% while the new route loads, then completes as soon as the
 * pathname changes. A safety timer completes it for search-only navigations or
 * cancelled requests, so the bar never gets stuck on screen.
 */
const START = 12;
const MAX = 92;
const TICK_MS = 120;
const SAFETY_MS = 1800;
const INITIAL_SWEEP_MS = 520;
const HIDE_DELAY_MS = 220;

export function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const previousPathRef = useRef(pathname);

  const clearLoadingTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    intervalRef.current = null;
    safetyRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (!activeRef.current) return;

    clearLoadingTimers();
    activeRef.current = false;
    setProgress(100);

    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, HIDE_DELAY_MS);
  }, [clearLoadingTimers]);

  const start = useCallback(() => {
    clearLoadingTimers();
    if (hideRef.current) clearTimeout(hideRef.current);
    if (initialRef.current) clearTimeout(initialRef.current);

    activeRef.current = true;
    setVisible(true);
    setProgress(START);

    intervalRef.current = setInterval(() => {
      setProgress((value) => Math.min(MAX, value + Math.max(1, (MAX - value) * 0.18)));
    }, TICK_MS);

    safetyRef.current = setTimeout(finish, SAFETY_MS);
  }, [clearLoadingTimers, finish]);

  // Short sweep on a full page load, so first paint feels intentional too.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      start();
      initialRef.current = setTimeout(finish, INITIAL_SWEEP_MS);
    });

    return () => {
      cancelAnimationFrame(frame);
      if (initialRef.current) clearTimeout(initialRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
      clearLoadingTimers();
    };
  }, [start, finish, clearLoadingTimers]);

  // App Router navigation completed: jump to 100% and fade out.
  useEffect(() => {
    if (previousPathRef.current !== pathname) {
      previousPathRef.current = pathname;
      finish();
    }
  }, [pathname, finish]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (!anchor || anchor.hasAttribute("download")) return;

      const anchorTarget = anchor.getAttribute("target");
      if (anchorTarget && anchorTarget !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.href === window.location.href) return;

      // A same-page hash change is not a render, so don't flash the bar.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash !== window.location.hash
      ) {
        return;
      }

      start();
    };

    const handlePopState = () => start();

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [start]);

  if (!visible) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full rounded-r-full transition-[width,opacity] duration-150 ease-out motion-reduce:transition-none"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
          background: "linear-gradient(90deg, var(--primary), var(--accent), var(--primary))",
          boxShadow: "0 0 12px color-mix(in srgb, var(--primary) 55%, transparent)",
        }}
      />
    </div>
  );
}
