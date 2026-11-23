import { afterEach, describe, expect, it, vi } from "vitest";

import { getAuthCookieOptions, getSessionMaxAgeSeconds, hashClientIp } from "./auth-security";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSessionMaxAgeSeconds", () => {
  it("uses 30 days when the setting is absent", () => {
    vi.stubEnv("AUTH_SESSION_MAX_AGE_SECONDS", undefined);
    expect(getSessionMaxAgeSeconds()).toBe(30 * 24 * 60 * 60);
  });

  it("accepts a valid configured lifetime", () => {
    vi.stubEnv("AUTH_SESSION_MAX_AGE_SECONDS", "3600");
    expect(getSessionMaxAgeSeconds()).toBe(3600);
  });

  it("falls back safely for invalid values", () => {
    vi.stubEnv("AUTH_SESSION_MAX_AGE_SECONDS", "not-a-number");
    expect(getSessionMaxAgeSeconds()).toBe(30 * 24 * 60 * 60);

    vi.stubEnv("AUTH_SESSION_MAX_AGE_SECONDS", "10");
    expect(getSessionMaxAgeSeconds()).toBe(30 * 24 * 60 * 60);
  });
});

describe("getAuthCookieOptions", () => {
  it("hardens the session cookie", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SESSION_MAX_AGE_SECONDS", "86400");

    expect(getAuthCookieOptions()).toEqual({
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: true,
      maxAge: 86400,
    });
  });

  it("allows non-secure cookies in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getAuthCookieOptions().secure).toBe(false);
    expect(getAuthCookieOptions().httpOnly).toBe(true);
  });
});

describe("hashClientIp", () => {
  it("returns a stable pseudonymous digest", () => {
    const first = hashClientIp("203.0.113.10");
    const second = hashClientIp("203.0.113.10");

    expect(first).toBe(second);
    expect(first).toHaveLength(32);
    expect(first).not.toContain("203.0.113.10");
  });

  it("uses only the first forwarded address", () => {
    expect(hashClientIp("203.0.113.10, 10.0.0.1")).toBe(hashClientIp("203.0.113.10"));
  });

  it("uses a neutral key when no address is available", () => {
    expect(hashClientIp(null)).toBe("unknown");
    expect(hashClientIp("   ")).toBe("unknown");
  });
});
