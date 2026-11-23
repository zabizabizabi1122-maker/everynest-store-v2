import { beforeEach, describe, expect, it, vi } from "vitest";

import { initialFormState } from "@/lib/form-state";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(async () => ({ get: vi.fn(() => "203.0.113.10") })),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  isLoginAllowed: vi.fn(),
  recordLoginAttempt: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/login-throttle", () => ({
  isLoginAllowed: mocks.isLoginAllowed,
  recordLoginAttempt: mocks.recordLoginAttempt,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
    from: mocks.from,
  })),
}));

import { loginAction } from "./actions";

function loginForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("email", "Admin@Example.com");
  form.set("password", "StrongPass123");
  form.set("next", "/admin/orders");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

function mockProfile(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
  };
  mocks.from.mockReturnValue(query);
}

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLoginAllowed.mockResolvedValue(true);
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: "2026-11-23T00:00:00Z" } },
      error: null,
    });
    mockProfile({ data: { role: "admin", is_active: true }, error: null });
  });

  it("redirects a verified active admin to the requested page", async () => {
    await expect(loginAction(initialFormState, loginForm())).rejects.toThrow(
      "NEXT_REDIRECT:/admin/orders",
    );

    expect(mocks.isLoginAllowed).toHaveBeenCalledWith(
      "admin@example.com",
      expect.any(String),
    );
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(
      "admin@example.com",
      expect.any(String),
      true,
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects and signs out an unverified account", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1", email_confirmed_at: null } },
      error: null,
    });

    const result = await loginAction(initialFormState, loginForm());

    expect(result.status).toBe("error");
    expect(result.message).toContain("confirm your email");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.recordLoginAttempt).toHaveBeenCalledWith(
      "admin@example.com",
      expect.any(String),
      false,
    );
  });

  it("rejects a customer session even with valid credentials", async () => {
    mockProfile({ data: { role: "customer", is_active: true }, error: null });

    const result = await loginAction(initialFormState, loginForm());

    expect(result.status).toBe("error");
    expect(result.message).toContain("administrator accounts");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("does not contact Supabase Auth while locked out", async () => {
    mocks.isLoginAllowed.mockResolvedValue(false);

    const result = await loginAction(initialFormState, loginForm());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Too many sign-in attempts");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});
