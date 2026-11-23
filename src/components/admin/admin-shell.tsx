"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { signOutAction } from "@/app/(auth)/actions";
import { roleLabel } from "@/lib/roles";

import { AdminNavIcon } from "./nav-icon";
import { ADMIN_NAV } from "./nav-items";
import { BrandMark } from "@/components/store/brand-mark";

import { SessionMonitor } from "./session-monitor";

interface AdminShellProps {
  children: ReactNode;
  userEmail: string;
  role: string;
  permissions: readonly string[];
}

/** Shared server-action logout button used by the responsive admin headers. */
function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        Log out
      </button>
    </form>
  );
}

const navRowClass =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition focus-visible:bg-[color:var(--surface-warm)]";

/**
 * Responsive admin chrome: a static sidebar from `lg` up, and an off-canvas
 * drawer on smaller screens.
 *
 * Client-side state is cosmetic only. Whether this shell renders at all is
 * decided on the server by `requireStaff()` in `app/admin/layout.tsx`.
 */
export function AdminShell({ children, userEmail, role, permissions }: AdminShellProps) {
  const pathname = usePathname();
  // The drawer remembers which route opened it. Browser Back/Forward changes
  // `pathname`, so the drawer closes automatically without an extra effect.
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const open = menuOpenFor === pathname;
  const closeMenu = () => setMenuOpenFor(null);
  const visibleNav = ADMIN_NAV.filter((item) => permissions.includes(item.permission));
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  // Escape closes the drawer, background scrolling stops, and focus moves in.
  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpenFor(null);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Return focus to the trigger when the drawer closes (keyboard users).
  useEffect(() => {
    if (wasOpen.current && !open) menuButtonRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(`${href}/`);

  const sidebarVisibility = open
    ? "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw]"
    : "hidden";

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <SessionMonitor />
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[color:var(--brand)] focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--brand)]"
      >
        Skip to content
      </a>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[color:var(--border)] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Link
          href="/admin"
          onClick={() => closeMenu()}
          className="text-[color:var(--brand)]"
        >
          <BrandMark variant="dark" size="sm" />
        </Link>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpenFor(pathname)}
          aria-expanded={open}
          aria-controls="admin-sidebar"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            aria-hidden="true"
            className="size-5"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          Menu
        </button>

        <LogoutButton className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]" />
      </header>

      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        {open ? (
          <button
            type="button"
            aria-label="Close admin menu"
            onClick={() => closeMenu()}
            className="fixed inset-0 z-40 cursor-default bg-neutral-900/40 lg:hidden"
          />
        ) : null}

        <aside
          ref={sidebarRef}
          id="admin-sidebar"
          aria-label="Admin navigation"
          className={`${sidebarVisibility} flex-col border-r border-[color:var(--border)] bg-white lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-screen lg:w-auto lg:max-w-none`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-4 py-4">
            <Link
              href="/admin"
              onClick={() => closeMenu()}
              className="text-[color:var(--brand)]"
            >
              <BrandMark variant="dark" size="sm" />
            </Link>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => closeMenu()}
              aria-label="Close admin menu"
              className="rounded-lg p-2 text-neutral-500 transition hover:bg-[color:var(--surface-warm)] hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)] lg:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                aria-hidden="true"
                className="size-5"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="border-b border-[color:var(--border)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Signed in
            </p>
            <p className="mt-1 truncate text-sm font-medium text-neutral-900">{userEmail}</p>
            <span className="mt-2 inline-flex rounded-full bg-[color:var(--brand-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--brand)]">
              {roleLabel(role)}
            </span>
          </div>

          <nav aria-label="Admin sections" className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {visibleNav.map((item) => {
                const active = isActive(item.href);

                if (!item.available) {
                  return (
                    <li key={item.href}>
                      <span
                        aria-disabled="true"
                        title="Available after administrator management is configured"
                        className={`${navRowClass} cursor-not-allowed text-neutral-400`}
                      >
                        <AdminNavIcon name={item.icon} className="size-5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                          {item.badge ?? "Soon"}
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => closeMenu()}
                      aria-current={active ? "page" : undefined}
                      className={`${navRowClass} ${
                        active
                          ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]"
                          : "text-neutral-700 hover:bg-[color:var(--surface-warm)] hover:text-neutral-900"
                      }`}
                    >
                      <AdminNavIcon name={item.icon} className="size-5 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-[color:var(--border)] p-3">
            <Link
              href="/"
              onClick={() => closeMenu()}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-[color:var(--surface-warm)] hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]"
            >
              View storefront
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="hidden items-center justify-between gap-4 border-b border-[color:var(--border)] bg-white px-8 py-3.5 lg:flex">
            <p className="text-sm text-neutral-500">Admin panel</p>
            <div className="flex items-center gap-4">
              <span className="max-w-[22rem] truncate text-sm text-neutral-600">{userEmail}</span>
              <LogoutButton className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]" />
            </div>
          </header>

          <main id="admin-main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
