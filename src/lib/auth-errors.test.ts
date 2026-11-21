import { describe, expect, it } from "vitest";

import { describeAuthError } from "./auth-errors";

describe("describeAuthError", () => {
  it("explains wrong credentials without leaking which field is wrong", () => {
    expect(describeAuthError("Invalid login credentials")).toBe(
      "Email or password is incorrect.",
    );
  });

  it("explains an unconfirmed email", () => {
    expect(describeAuthError("Email not confirmed")).toBe(
      "Please confirm your email address before logging in.",
    );
  });

  it("handles duplicate signups", () => {
    expect(describeAuthError("User already registered")).toContain("already exists");
  });

  it("explains rate limiting", () => {
    expect(describeAuthError("Email rate limit exceeded")).toContain("Too many attempts");
  });

  it("never returns the raw provider message", () => {
    const raw = "unexpected_failure: pq: relation auth.identities does not exist";
    const shown = describeAuthError(raw);

    expect(shown).not.toContain("pq:");
    expect(shown).toBe("Something went wrong. Please try again.");
  });

  it("falls back safely for empty input", () => {
    expect(describeAuthError(null)).toBe("Something went wrong. Please try again.");
    expect(describeAuthError(undefined)).toBe("Something went wrong. Please try again.");
    expect(describeAuthError("")).toBe("Something went wrong. Please try again.");
  });
});
