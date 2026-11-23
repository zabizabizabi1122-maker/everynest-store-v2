"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface SessionStatus {
  authenticated: boolean;
  expiresAt?: number | null;
}

const CHECK_INTERVAL_MS = 60_000;
const EXPIRY_SKEW_MS = 30_000;

/**
 * Invisible session watchdog for signed-in admins.
 *
 * The server is still the authority: this component only notices an
 * expired/invalid session sooner, clears it through a server Route Handler and
 * sends the browser to the login page with a clear explanation. It renders no
 * UI, so there is no authentication flicker.
 */
export function SessionMonitor() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const expireSession = async () => {
      try {
        await fetch("/auth/session", { method: "POST", credentials: "same-origin" });
      } catch {
        // Even if cleanup fails, navigation to /login is still safe.
      }

      router.replace("/login?notice=session-expired");
    };

    const check = async () => {
      try {
        const response = await fetch("/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Session check failed");

        const status = (await response.json()) as SessionStatus;
        if (!active) return;

        const expired =
          typeof status.expiresAt === "number" &&
          status.expiresAt > 0 &&
          Date.now() >= status.expiresAt - EXPIRY_SKEW_MS;

        if (!status.authenticated || expired) {
          await expireSession();
        }
      } catch {
        // Network hiccups are not proof of an invalid session; retry later.
      }
    };

    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
